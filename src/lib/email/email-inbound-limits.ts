/** Limits and patterns for `/api/tasks/from-email` inbound JSON (mirrors route validation). */
export const EMAIL_TASK_SUBJECT_MAX = 240;
export const EMAIL_TASK_BODY_MAX = 10_000;
export const EMAIL_TASK_FROM_MAX = 320;
export const EMAIL_TASK_EXTERNAL_MESSAGE_ID_RE = /^[a-zA-Z0-9._:@\-]{1,200}$/;
