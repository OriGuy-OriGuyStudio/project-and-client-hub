-- ============================================================
-- Phase 2B follow-up: a "viewer" (org member with no capabilities) must be
-- read-only. Phase 2A gated files/approvals/service-calls/finance, but member
-- CONTENT (project docs + dev-feedback notes) was still writable by any member
-- via can_access_project. Gate those on the `files` capability so a viewer can
-- read them but cannot create/edit; a team member (files) still can. Admin
-- always. Behavior-preserving for solo-org managers (they hold files).
-- ============================================================

-- project docs (מסמכים): create/edit require the files capability.
alter policy project_docs_insert on public.project_docs
  with check (is_admin() or ((select public.member_can(project_id, 'files')) and (is_private = false)));
alter policy project_docs_update on public.project_docs
  using (is_admin() or ((select public.member_can(project_id, 'files')) and (not is_private)))
  with check (is_admin() or ((select public.member_can(project_id, 'files')) and (not is_private)));

-- dev-feedback notes (הערות פיתוח): create/delete require the files capability.
alter policy dev_feedback_insert on public.dev_feedback
  with check ((is_admin() or (select public.member_can(project_id, 'files'))) and (author_id = auth.uid()));
alter policy dev_feedback_delete on public.dev_feedback
  using (is_admin() or ((select public.member_can(project_id, 'files')) and (author_id = auth.uid()) and (status = 'received')));

notify pgrst, 'reload schema';
