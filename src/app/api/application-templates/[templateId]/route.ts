import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentHacker, isSiteAdmin } from '@/lib/eventManagementApi';
import {
  ApplicationTemplateValidationError,
  parseTemplateFieldsJson,
} from '@/lib/applicationTemplates';
import { canManageChapterSettings } from '@/lib/eventManagementAuth';
import type {
  ApplicationTemplateScope,
  TemplateFieldDefinition,
} from '@/types/event-management';

async function getActiveSiteRequiredFields(): Promise<
  TemplateFieldDefinition[] | undefined
> {
  const siteTemplate = await prisma.applicationTemplate.findFirst({
    where: { scope: 'SITE', isActive: true },
    orderBy: { updatedAt: 'desc' },
    select: { fieldsJson: true },
  });

  if (!siteTemplate) return undefined;

  return parseTemplateFieldsJson(
    siteTemplate.fieldsJson,
    'siteTemplate.fieldsJson',
    {
      requireSiteRequiredFields: true,
    }
  ).filter(field => field.siteRequired);
}

function activeTemplateScopeFilter(
  scope: ApplicationTemplateScope,
  chapterId: string | null
) {
  return scope === 'SITE'
    ? { scope: 'SITE' as const, isActive: true }
    : {
        scope: 'CHAPTER' as const,
        chapterId,
        isActive: true,
      };
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ templateId: string }> }
) {
  const params = await props.params;
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return new NextResponse('Unauthorized', { status: 401 });

    const existing = await prisma.applicationTemplate.findUnique({
      where: { id: params.templateId },
      select: { id: true, scope: true, chapterId: true },
    });
    if (!existing) return new NextResponse('Not Found', { status: 404 });

    const canManage =
      isSiteAdmin(hacker) ||
      (existing.scope === 'CHAPTER' &&
        existing.chapterId &&
        (await canManageChapterSettings(
          prisma,
          hacker.id,
          existing.chapterId
        )));
    if (!canManage) return new NextResponse('Forbidden', { status: 403 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body?.name !== undefined) data.name = body.name;
    if (body?.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body?.fieldsJson !== undefined) {
      const requiredSiteFields =
        existing.scope === 'CHAPTER'
          ? await getActiveSiteRequiredFields()
          : undefined;
      data.fieldsJson = parseTemplateFieldsJson(body.fieldsJson, 'fieldsJson', {
        requireSiteRequiredFields: existing.scope === 'SITE',
        allowSiteRequiredFieldIds: existing.scope === 'SITE',
        requiredSiteFields,
      });
    }

    if (data.isActive === true) {
      await prisma.applicationTemplate.updateMany({
        where: {
          ...activeTemplateScopeFilter(
            existing.scope as ApplicationTemplateScope,
            existing.chapterId
          ),
          id: { not: existing.id },
        },
        data: { isActive: false },
      });
    }

    const template = await prisma.applicationTemplate.update({
      where: { id: params.templateId },
      data,
    });

    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof ApplicationTemplateValidationError) {
      return NextResponse.json(
        { message: error.message, issues: error.issues },
        { status: 400 }
      );
    }
    console.error('[APPLICATION_TEMPLATE_PATCH]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  props: { params: Promise<{ templateId: string }> }
) {
  const params = await props.params;
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return new NextResponse('Unauthorized', { status: 401 });

    const existing = await prisma.applicationTemplate.findUnique({
      where: { id: params.templateId },
      select: { id: true, scope: true, chapterId: true, isActive: true },
    });
    if (!existing) return new NextResponse('Not Found', { status: 404 });

    const canManage =
      isSiteAdmin(hacker) ||
      (existing.scope === 'CHAPTER' &&
        existing.chapterId &&
        (await canManageChapterSettings(
          prisma,
          hacker.id,
          existing.chapterId
        )));
    if (!canManage) return new NextResponse('Forbidden', { status: 403 });

    if (existing.scope === 'SITE' && existing.isActive) {
      return NextResponse.json(
        {
          message:
            'The active site template is the base for all chapters and cannot be deleted.',
        },
        { status: 400 }
      );
    }

    await prisma.applicationTemplate.delete({
      where: { id: params.templateId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[APPLICATION_TEMPLATE_DELETE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
