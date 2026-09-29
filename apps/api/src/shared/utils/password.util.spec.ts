import { passwordProblem, passwordStrength } from "@/shared/utils/password.util";

describe("passwordProblem", () => {
	it("accepts an ordinary passphrase", () => {
		expect(passwordProblem("ร้านกาแฟหน้าปากซอย")).toBeNull();
		expect(passwordProblem("blue-kettle-morning")).toBeNull();
	});

	it("wants at least 8 characters, counting Thai as one each", () => {
		expect(passwordProblem("abc12")).toBe("tooShort");
		expect(passwordProblem("กาแฟเย็นห")).toBeNull();
	});

	it("refuses more than bcrypt's 72 bytes", () => {
		const thai24 = "ร้านกาแฟหน้าปากซอยเปิดเช";
		expect([...thai24].length).toBe(24); // 72 bytes
		expect(passwordProblem(thai24)).toBeNull();
		expect(passwordProblem(`${thai24}า`)).toBe("tooLong");
	});

	it.each([
		"password",
		"Password123!",
		"12345678",
		"87654321",
		"qwertyui",
		"11111111",
		"12341234",
		"abcabcabc",
		"iloveyou2024",
	])("refuses %s as common", (pw) => expect(passwordProblem(pw)).toBe("common"));

	it("refuses the email's name part or the person's name", () => {
		expect(passwordProblem("somchai2024", { email: "somchai@gmail.com" })).toBe(
			"personal"
		);
		expect(passwordProblem("xx-Malee-99", { name: "Malee Sukjai" })).toBe(
			"personal"
		);
		expect(
			passwordProblem("blue-kettle-morning", {
				email: "somchai@gmail.com",
				name: "Somchai",
			})
		).toBeNull();
	});
});

describe("passwordStrength", () => {
	it("rates by length and variety", () => {
		expect(passwordStrength("12345678")).toBe(0);
		expect(passwordStrength("kettlebl")).toBe(1);
		expect(passwordStrength("Kettle-blue9")).toBe(3);
		expect(passwordStrength("blue kettle morning")).toBe(3);
	});
});
