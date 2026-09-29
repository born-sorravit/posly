import { TransformFnParams } from "class-transformer";

/** `?flag=true` / `?flag=1` -> true. Anything else falsy, so an absent flag never blocks. */
export const toBoolean = ({ value }: TransformFnParams): boolean | undefined => {
	if (value === undefined || value === null || value === "") return undefined;
	return value === true || value === "true" || value === "1";
};

/** Collapses a blank or whitespace-only search box to `undefined` rather than matching "". */
export const toTrimmedString = ({
	value,
}: TransformFnParams): string | undefined => {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed === "" ? undefined : trimmed;
};

export const normaliseEmail = ({ value }: TransformFnParams): unknown =>
	typeof value === "string" ? value.trim().toLowerCase() : value;

export const trimmed = ({ value }: TransformFnParams): unknown =>
	typeof value === "string" ? value.trim() : value;
