/** How an account signs in. `passwordHash` is null for anything but PASSWORD. */
export enum AuthProvider {
	PASSWORD = "PASSWORD",
	GOOGLE = "GOOGLE",
}
