import { activeClientDictionary } from "@/lib/client/locale";

export function apiErrorMessage(json: unknown, fallback?: string): string {
  const errors = activeClientDictionary().apiErrors;
  const fallbackMessage = fallback ?? errors.actionFailed;
  if (!json || typeof json !== "object") return fallbackMessage;
  const data = json as Record<string, unknown>;
  const raw = typeof data.detail === "string" && data.detail.trim()
    ? data.detail.trim()
    : typeof data.error === "string" && data.error.trim()
      ? data.error.trim()
      : "";
  if (!raw) return fallbackMessage;
  if (raw === "invalid_body") return errors.invalidBody;
  if (raw === "forbidden") return errors.forbidden;
  if (raw === "widget_invalid") return errors.widgetInvalid;
  if (raw === "not_found") return errors.notFound;
  if (raw === "save_failed") return errors.saveFailed;
  if (raw === "claim_failed") return errors.claimFailed;
  if (raw === "publish_failed") return errors.publishFailed;
  if (raw === "duplicate_failed") return errors.duplicateFailed;
  if (raw === "delete_failed") return errors.deleteFailed;
  if (raw === "update_failed") return errors.updateFailed;
  if (raw === "modules_conflict") return errors.modulesConflict;
  if (raw === "contract_conflict") return errors.contractConflict;
  if (raw === "slot_taken") return errors.slotTaken;
  if (raw === "rate_limited") return errors.rateLimited;
  if (raw === "state_limit_reached") return errors.stateLimitReached;
  if (raw === "presets_failed") return errors.presetsFailed;
  if (raw === "preset_state_migration_required") return errors.presetStateMigrationRequired;
  if (raw === "preset_not_saved") return errors.presetNotSaved;
  if (raw === "preset_materialization_failed") return errors.presetMaterializationFailed;
  if (raw === "members_failed") return errors.membersFailed;
  if (raw === "project_members_migration_required") return errors.projectMembersMigrationRequired;
  if (raw === "project_invitations_migration_required") return errors.projectInvitationsMigrationRequired;
  if (raw === "invitation_not_available") return errors.invitationNotAvailable;
  if (raw === "invitations_failed") return errors.invitationsFailed;
  if (raw === "member_is_owner") return errors.memberIsOwner;
  if (raw === "member_already_active") return errors.memberAlreadyActive;
  if (raw === "support_failed") return errors.supportFailed;
  if (raw === "clerk_update_failed") return errors.clerkUpdateFailed;
  if (raw === "upload_failed") return errors.uploadFailed;
  if (raw === "mime_not_allowed") return errors.mimeNotAllowed;
  if (raw === "upload_state_failed") return errors.uploadStateFailed;
  if (raw === "storage_sign_failed" || raw === "asset_sign_failed") return errors.storageSignFailed;
  if (raw === "storage_missing") return errors.storageMissing;
  if (raw === "asset_delete_failed") return errors.assetDeleteFailed;
  if (raw === "storage_quota_exceeded") return errors.storageQuotaExceeded;
  if (raw === "bad_asset_path" || raw === "upload_reference_required") return errors.badAssetPath;
  if (raw === "module_out_of_range") return errors.moduleOutOfRange;
  if (raw === "state_cleanup_failed" || raw === "state_check_failed") {
    return errors.stateWriteFailed;
  }
  if (raw === "state_write_failed") return errors.stateWriteFailed;
  if (raw === "contract_signed") return errors.contractSigned;
  if (raw === "project_inactive") return errors.projectInactive;
  if (raw === "bad_stage") return errors.badStage;
  if (raw === "invalid_stage_transition") return errors.invalidStageTransition;
  if (raw === "contract_draft_failed") return errors.contractDraftFailed;
  if (raw === "contract_already_released") return errors.contractAlreadyReleased;
  if (raw === "signature_required") return errors.signatureRequired;
  if (raw === "nothing_to_update") return errors.nothingToUpdate;
  if (raw === "owner_token_required" || raw === "owner_token_mismatch") {
    return errors.ownerTokenRequired;
  }
  return raw.replace(/_/g, " ");
}

export function withOwnerToken(payload: Record<string, unknown>, ownerToken: string | null): Record<string, unknown> {
  return ownerToken ? { ...payload, anonOwnerToken: ownerToken } : payload;
}
