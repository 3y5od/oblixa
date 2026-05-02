# Server Actions surface (heuristics)

Generated: 2026-05-02T01:16:17.442Z

**Disclaimer:** Exported async functions and substring flags are approximate. Review each action for authz parity with API routes.

Regenerate:

```bash
npm run report:security-server-actions
```

**Total files:** 27

| File | export async function … | Signals |
|------|-------------------------|---------|
| `src/actions/approvals.ts` | requestContractApproval, requestContractApprovalForm, updateContractApprovalStatus, updateContractApprovalStatusForm, delegateContractApproval, delegateContractApprovalForm, upsertRenewalScenario, upsertRenewalScenarioForm | createAdminClient, createClient, getUser, org/membership hints |
| `src/actions/auth.ts` | signUp, signIn, signOut, forgotPassword, resetPassword | createAdminClient, createClient, getUser, org/membership hints |
| `src/actions/automation.ts` | createTaskAutomationRule, createTaskAutomationRuleForm, toggleTaskAutomationRule, toggleTaskAutomationRuleForm, runTaskAutomationRulesForOrg | createAdminClient, createClient, getUser, org/membership hints |
| `src/actions/contracts-lifecycle.ts` | updateContractStatus, updateContractOperationalState, upsertContractIntakeRequest, updateContractExternalLink, deleteContract, applyContractTemplatePack | createAdminClient, createClient, getUser, org/membership hints |
| `src/actions/contracts.ts` | createContract, updateContractField, updateContractSecondaryOwner, upsertContractHandoffChecklist, updateContractHandoffChecklistStatus, updateContractHandoffChecklistStatusForm, upsertContractHandoffChecklistForm, addManualField, uploadAdditionalFiles, supersedeContractFile, supersedeContractFileForm, runExtraction, batchApproveReadyFields, bulkCreateContractsFromFiles, updateContractOwner, bulkAssignContractOwners, getFileDownloadUrl, updateContractStatus, updateContractOperationalState, updateContractOperationalStateForm, upsertContractIntakeRequest, upsertContractIntakeRequestForm, updateContractExternalLink, updateContractExternalLinkForm, deleteContract, applyContractTemplatePack, applyContractTemplatePackForm | createAdminClient, createClient, getUser, org/membership hints |
| `src/actions/dashboard.ts` | setDashboardQueuePinForm | createAdminClient, createClient, getUser, org/membership hints |
| `src/actions/demo.ts` | seedDemoWorkspace | org/membership hints |
| `src/actions/exceptions.ts` | assignException, resolveException, reopenException | createAdminClient, createClient, getUser, org/membership hints |
| `src/actions/field-comments.ts` | addFieldComment, addFieldCommentForm, markNotificationRead, markNotificationReadVoid | createAdminClient, createClient, getUser, org/membership hints |
| `src/actions/maintenance.ts` | archiveContractAsDuplicateForm, reassignOwnerForm, deleteOrphanFileRecordForm, runDateBackfillCampaignForm, runCorrectionCampaignForm, logContractChangeEventForm, processContractChangeEventsForm | createAdminClient, createClient, getUser, org/membership hints |
| `src/actions/mfa.ts` | startTotpEnrollment, verifyTotpEnrollment, unenrollTotpFactor, updateOrganizationMfaRequired | createAdminClient, createClient, getUser, org/membership hints |
| `src/actions/notes.ts` | createContractNote, toggleContractNotePin, deleteContractNote | createAdminClient, createClient, getUser, org/membership hints |
| `src/actions/obligations.ts` | createContractObligation, updateContractObligation, deleteContractObligation, createObligationTemplate, createObligationTemplateForm, applyObligationTemplatesToContract, applyObligationTemplatesToContractForm | createAdminClient, createClient, getUser, org/membership hints |
| `src/actions/onboarding-calibration.ts` | previewCalibrationRecommendation, recordQuestionnaireStarted, saveQuestionnaireProgress, startRecalibrationFromSettingsForm, beginRecalibration, completeQuestionnaireAcceptRecommendation, completeQuestionnaireSimplerSetup, skipQuestionnaireExplicitMinimal, completeQuestionnaireOpenAdvancedSettings, exportOnboardingCalibrationSupportJson | zod, org/membership hints |
| `src/actions/product-surface-settings.ts` | updateWorkspaceProductSurfaceForm, resetWorkspaceProductSurfaceDefaultsForm, updateProductEmailNotificationCategoriesForm | org/membership hints |
| `src/actions/product-telemetry.ts` | emitCmdkPaletteOpenedTelemetry, emitCmdkResultSelectedTelemetry, emitCmdkZeroResultsTelemetry, emitCmdkSearchFailedTelemetry, emitReviewSaveNextUsedTelemetry, emitV10EmptyStateCtaClickedTelemetry, emitPageLoadMeasuredTelemetry | zod |
| `src/actions/renewal-playbook.ts` | seedRenewalPlaybook, updateRenewalCheckpointStatus, addRenewalWorkspaceNote, addRenewalWorkspaceNoteForm | createAdminClient, createClient, getUser, org/membership hints |
| `src/actions/saved-views.ts` | createContractsSavedView, createContractsSavedViewWithFeedback, createSavedView, setSavedViewPinned, deleteSavedView, setSavedViewWeeklySummary, setSavedViewMonthlySummary, setSavedViewWeeklyRecipients | createAdminClient, createClient, getUser, org/membership hints |
| `src/actions/sessions.ts` | listMySessions, revokeOtherSessions | createAdminClient, createClient, getUser |
| `src/actions/settings.ts` | updateProfile, updateOrganization, inviteOrgMember, revokeOrgInvite, resendOrgInvite, completeProductOnboarding | createAdminClient, createClient, getUser, org/membership hints |
| `src/actions/tasks-automation.ts` | autoTransitionTasksForApproval, autoTransitionTasksForField | createAdminClient, org/membership hints |
| `src/actions/tasks.ts` | autoTransitionTasksForApproval, autoTransitionTasksForField, createContractTask, createClarificationTask, createClarificationTaskForm, createObligationClarificationTaskForm, createCheckpointClarificationTaskForm, createCheckpointClarificationTask, createRuleGeneratedTask, assignWorkItemOwner, bulkAssignCompatibleContractTasks, completeWorkItem, updateContractTaskStatus, bulkCompleteCompatibleContractTasks, addContractTaskComment, updateContractTaskComment, deleteContractTaskComment, addContractTaskChecklistItem, addContractTaskDependency, toggleContractTaskChecklistItem, updateContractTaskChecklistItem, deleteContractTaskChecklistItem, reorderContractTaskChecklistItem, addContractTaskArtifact, deleteContractTaskArtifact, deleteContractTask | createAdminClient, createClient, getUser, org/membership hints |
| `src/actions/v10-bulk-compatible-work.ts` | bulkAssignCompatibleV10WorkItems, bulkCompleteCompatibleV10WorkItems | createAdminClient, createClient, getUser, org/membership hints |
| `src/actions/v4-surface-guards.ts` | ensureProgramsSurfaceAccess, ensureReportPackReportTypeAllowed | createAdminClient |
| `src/actions/v4.ts` | createProgramAction, publishProgramAction, applyProgramAction, createExceptionAction, createReportPackAction, saveProgramVersionDefinitionAction, updateProgramRoutingAction, updateProgramAssignmentOverrideFormAction, updateProgramAssignmentOverrideAction, submitEvidenceNoteAction, createEvidenceTemplateAction, savePolicyRegistryAction, saveReportPackAnnotationsAction, createReportPackSubscriptionAction, updateRenewalCheckpointWorkspaceFormAction, updateRenewalCheckpointWorkspaceAction, updateRenewalCheckpointRenewalStateFormAction, updateRenewalCheckpointRenewalStateAction, generateRenewalDecisionPacketFormAction, generateRenewalDecisionPacketAction | createAdminClient, createClient, getUser, org/membership hints |
| `src/actions/watchlists.ts` | upsertWatchlistEntryForm, removeWatchlistEntry | createAdminClient, createClient, getUser, org/membership hints |
| `src/actions/workflow-config.ts` | createRenewalPlaybookTemplateForm, toggleRenewalPlaybookTemplate, toggleRenewalPlaybookTemplateForm, createWebhookSubscriptionForm, toggleWebhookSubscription, toggleWebhookSubscriptionForm, createFieldTemplateForm, createReminderTemplateForm, createTaskTemplateForm, upsertIntegrationConnectionForm, upsertWorkflowSettingsForm, applyPolicyPackForm, createApprovalPolicyForm, toggleApprovalPolicyForm, setIntegrationTokenForm, createIntegrationApiKey, revokeIntegrationApiKeyForm, updateIntegrationApiKeyPolicyForm | createAdminClient, createClient, getUser, org/membership hints |
