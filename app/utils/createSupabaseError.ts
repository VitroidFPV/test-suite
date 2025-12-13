import type { PostgrestError } from "@supabase/supabase-js"

/**
 * Creates an Error object with Supabase/PostgREST error properties attached.
 * This preserves the code, details, hint, etc. for display in error UIs.
 */
export function createSupabaseError(error: PostgrestError): Error {
	const err = new Error(error.message) as Error & {
		code?: string
		details?: string
		hint?: string
		statusCode?: number
	}

	err.code = error.code
	err.details = error.details
	err.hint = error.hint

	return err
}
