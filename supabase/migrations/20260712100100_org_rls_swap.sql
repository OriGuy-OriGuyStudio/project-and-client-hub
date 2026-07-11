-- ============================================================
-- Organizations multi-tenancy — Phase 1: route project access through the org.
-- ============================================================
-- Every client-facing project-scoped policy now gates on can_access_project()
-- (member of the project's org) instead of owns_project() (the single client_id).
-- projects/client_brand gate on org membership (with a client_id fallback so no
-- row can become invisible if org_id backfill missed anything). Admin policies
-- are untouched. Uses ALTER POLICY so role/cmd/permissive attributes are
-- preserved and only the expression changes. Referral/credit + agreement/brand
-- tables are intentionally NOT swapped in Phase 1 (see the design spec).
--
-- For solo orgs (every existing client) this is behavior-preserving: the manager
-- is the only member, so can_access_project == owns_project and
-- is_org_member(org_id) == (client_id = auth.uid()).
-- ============================================================

-- activity_log
alter policy activity_log_insert on public.activity_log
  with check (is_admin() or ((select public.can_access_project(project_id)) and (actor_id = auth.uid())));
alter policy activity_log_select on public.activity_log
  using ((select public.can_access_project(project_id)) or is_admin());

-- approvals
alter policy approvals_client_update on public.approvals
  using ((select public.can_access_project(project_id)) or is_admin())
  with check ((select public.can_access_project(project_id)) or is_admin());
alter policy approvals_select on public.approvals
  using ((select public.can_access_project(project_id)) or is_admin());

-- checklist_items
alter policy checklist_client_update on public.checklist_items
  using ((select public.can_access_project(project_id)) or is_admin())
  with check ((select public.can_access_project(project_id)) or is_admin());
alter policy checklist_select on public.checklist_items
  using ((select public.can_access_project(project_id)) or is_admin());

-- dev_feedback
alter policy dev_feedback_delete on public.dev_feedback
  using (is_admin() or ((select public.can_access_project(project_id)) and (author_id = auth.uid()) and (status = 'received'::text)));
alter policy dev_feedback_insert on public.dev_feedback
  with check ((is_admin() or (select public.can_access_project(project_id))) and (author_id = auth.uid()));
alter policy dev_feedback_select on public.dev_feedback
  using (is_admin() or (select public.can_access_project(project_id)));

-- files
alter policy files_delete on public.files
  using (is_admin() or ((uploaded_by = auth.uid()) and (not is_private) and (select public.can_access_project(project_id))));
alter policy files_insert on public.files
  with check (is_admin() or ((select public.can_access_project(project_id)) and (is_private = false) and (uploaded_by = auth.uid())));
alter policy files_select on public.files
  using (((not is_private) and (select public.can_access_project(project_id))) or is_admin());

-- guide_articles
alter policy guide_articles_select on public.guide_articles
  using (is_admin() or ((select public.can_access_project(project_id)) and is_published));

-- maintenance_log
alter policy maintenance_log_client_read on public.maintenance_log
  using ((select public.can_access_project(project_id)));

-- messages
alter policy messages_insert on public.messages
  with check ((sender_id = auth.uid()) and ((select public.can_access_project(project_id)) or is_admin()));
alter policy messages_select on public.messages
  using ((select public.can_access_project(project_id)) or is_admin());
alter policy messages_update_read on public.messages
  using ((select public.can_access_project(project_id)) or is_admin())
  with check ((select public.can_access_project(project_id)) or is_admin());

-- payments
alter policy payments_select on public.payments
  using ((select public.can_access_project(project_id)) or is_admin());

-- project_docs
alter policy project_docs_insert on public.project_docs
  with check (is_admin() or ((select public.can_access_project(project_id)) and (is_private = false)));
alter policy project_docs_select on public.project_docs
  using (((not is_private) and (select public.can_access_project(project_id))) or is_admin());
alter policy project_docs_update on public.project_docs
  using (is_admin() or ((select public.can_access_project(project_id)) and (not is_private)))
  with check (is_admin() or ((select public.can_access_project(project_id)) and (not is_private)));

-- project_folders
alter policy project_folders_delete on public.project_folders
  using (is_admin() or (select public.can_access_project(project_id)));
alter policy project_folders_insert on public.project_folders
  with check (is_admin() or ((select public.can_access_project(project_id)) and (created_by = auth.uid())));
alter policy project_folders_select on public.project_folders
  using ((select public.can_access_project(project_id)) or is_admin());

-- project_service
alter policy project_service_client_read on public.project_service
  using ((select public.can_access_project(project_id)));

-- project_site_credentials
alter policy site_credentials_select on public.project_site_credentials
  using (is_admin() or (select public.can_access_project(project_id)));

-- project_stages
alter policy project_stages_select on public.project_stages
  using ((select public.can_access_project(project_id)) or is_admin());

-- service_calls
alter policy service_calls_client_read on public.service_calls
  using ((select public.can_access_project(project_id)));

-- site_metrics
alter policy site_metrics_client_read on public.site_metrics
  using ((select public.can_access_project(project_id)));

-- stage_tasks (nested EXISTS on project_stages)
alter policy stage_tasks_select on public.stage_tasks
  using (is_admin() or (exists (
    select 1 from public.project_stages s
    where s.id = stage_tasks.stage_id and public.can_access_project(s.project_id)
  )));

-- tasks
alter policy tasks_client_update on public.tasks
  using (((select public.can_access_project(project_id)) and (not is_private)) or is_admin())
  with check (((select public.can_access_project(project_id)) and (not is_private)) or is_admin());
alter policy tasks_select on public.tasks
  using (((not is_private) and (select public.can_access_project(project_id))) or is_admin());

-- projects: org membership, with client_id fallback (Phase 1 safety)
alter policy projects_select on public.projects
  using ((select public.is_org_member(org_id)) or (client_id = auth.uid()) or is_admin());

-- client_brand: org membership, with client_id fallback (Phase 1 safety)
alter policy client_brand_select on public.client_brand
  using ((select public.is_org_member(org_id)) or (client_id = auth.uid()) or is_admin());

notify pgrst, 'reload schema';
