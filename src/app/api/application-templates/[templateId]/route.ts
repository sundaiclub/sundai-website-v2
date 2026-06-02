import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentHacker, isSiteAdmin } from '@/lib/eventManagementApi';
import {
  ApplicationTemplateValidationError,
  parseTemplateFieldsJson,
} from '@/lib/applicationTemplates';
import { canManageChapterSettings } from '@/lib/eventManagementAuth';

export async function PATCH(
  req: Request,
  { params }: { params: { templateId: string } }
) {
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
        (await canManageChapterSettings(prisma, hacker.id, existing.chapterId)));
    if (!canManage) return new NextResponse('Forbidden', { status: 403 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body?.name !== undefined) data.name = body.name;
    if (body?.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body?.fieldsJson !== undefined) {
      data.fieldsJson = parseTemplateFieldsJson(body.fieldsJson, 'fieldsJson', {
        requireSiteRequiredFields: existing.scope === 'SITE',
        allowSiteRequiredFieldIds: existing.scope === 'SITE',
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
