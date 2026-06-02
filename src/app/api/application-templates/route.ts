import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  badRequest,
  getCurrentHacker,
  isSiteAdmin,
  requireSiteAdmin,
} from '@/lib/eventManagementApi';
import {
  ApplicationTemplateValidationError,
  assertValidApplicationTemplateFields,
  parseTemplateFieldsJson,
} from '@/lib/applicationTemplates';
import { canManageChapterSettings } from '@/lib/eventManagementAuth';

export async function GET(req: Request) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return new NextResponse('Unauthorized', { status: 401 });

    const url = new URL(req.url);
    const chapterId = url.searchParams.get('chapterId');
    const where = isSiteAdmin(hacker)
      ? chapterId
        ? { OR: [{ scope: 'SITE' as const }, { chapterId }] }
        : {}
      : chapterId &&
          (await canManageChapterSettings(prisma, hacker.id, chapterId))
        ? { OR: [{ scope: 'SITE' as const }, { chapterId }] }
        : { scope: 'SITE' as const, isActive: true };

    const templates = await prisma.applicationTemplate.findMany({
      where,
      include: {
        chapter: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ scope: 'asc' }, { updatedAt: 'desc' }],
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('[APPLICATION_TEMPLATES_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return new NextResponse('Unauthorized', { status: 401 });

    const body = await req.json();
    const scope = body?.scope;
    const chapterId = body?.chapterId ?? null;

    if (scope !== 'SITE' && scope !== 'CHAPTER') {
      return badRequest('scope must be SITE or CHAPTER');
    }
    if (scope === 'SITE' && !isSiteAdmin(hacker)) return requireSiteAdmin().then(r => r.response!);
    if (
      scope === 'CHAPTER' &&
      (!chapterId ||
        (!isSiteAdmin(hacker) &&
          !(await canManageChapterSettings(prisma, hacker.id, chapterId))))
    ) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const fields = parseTemplateFieldsJson(body?.fieldsJson, 'fieldsJson', {
      requireSiteRequiredFields: scope === 'SITE',
      allowSiteRequiredFieldIds: scope === 'SITE',
    });
    assertValidApplicationTemplateFields(fields, {
      requireSiteRequiredFields: scope === 'SITE',
      allowSiteRequiredFieldIds: scope === 'SITE',
    });

    const template = await prisma.applicationTemplate.create({
      data: {
        scope,
        chapterId: scope === 'CHAPTER' ? chapterId : null,
        name: body?.name || (scope === 'SITE' ? 'Site template' : 'Chapter template'),
        fieldsJson: JSON.parse(JSON.stringify(fields)),
        isActive: body?.isActive ?? true,
        createdById: hacker.id,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    if (error instanceof ApplicationTemplateValidationError) {
      return NextResponse.json({ message: error.message, issues: error.issues }, { status: 400 });
    }
    console.error('[APPLICATION_TEMPLATES_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
