import * as z from 'zod';

/**
 * The Thai error messages the API returns and the screens display, in one place.
 *
 * TOR NFR-04 requires every error to be Thai, actionable, and free of stack traces or database
 * detail; TOR section 6.2 requires it to say whether the user should correct their input or retry.
 * `action` makes that choice machine-readable so a screen can present the two cases differently.
 *
 * This is a message catalogue, not an internationalisation framework: section 2 of the spec names
 * no second language, so the text is written directly in Thai. If a second language ever earns a
 * requirement, this module is the only one that forks.
 */

/** What the user should do next, per TOR section 6.2. */
export const ErrorActionSchema = z.enum(['CORRECT_INPUT', 'RETRY']);
export type ErrorAction = z.infer<typeof ErrorActionSchema>;

/** The payload every API error carries, declared here so neither app hand-writes the shape. */
export const AppErrorDataSchema = z.object({ action: ErrorActionSchema });
export type AppErrorData = z.infer<typeof AppErrorDataSchema>;

export type AppError = {
  readonly action: ErrorAction;
  readonly message: string;
};

export const APP_ERRORS = {
  INVALID_CREDENTIALS: {
    action: 'CORRECT_INPUT',
    message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบแล้วกรอกใหม่อีกครั้ง',
  },
  UNEXPECTED: {
    action: 'RETRY',
    message: 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง หากยังไม่สำเร็จโปรดแจ้งผู้ดูแลระบบ',
  },
  /** Raised by the web app alone, when a request never reached the API. */
  UNREACHABLE: {
    action: 'RETRY',
    message: 'ไม่สามารถเชื่อมต่อระบบได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้ง',
  },
  STORE_CODE_TAKEN: {
    action: 'CORRECT_INPUT',
    message: 'รหัสสาขานี้ถูกใช้แล้ว กรุณาใช้รหัสอื่นแล้วบันทึกอีกครั้ง',
  },
  STORE_NOT_FOUND: {
    action: 'CORRECT_INPUT',
    message: 'ไม่พบสาขาที่ระบุ อาจถูกลบไปแล้ว กรุณาโหลดรายการใหม่แล้วลองอีกครั้ง',
  },
} as const satisfies Record<string, AppError>;

export type AppErrorCode = keyof typeof APP_ERRORS;

/** Declares a catalogue entry as an oRPC route error, so the contract carries the Thai text. */
export function routeError(code: AppErrorCode, status: number) {
  return { status, message: APP_ERRORS[code].message, data: AppErrorDataSchema };
}
