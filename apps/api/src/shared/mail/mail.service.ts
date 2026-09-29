import { Global, Injectable, Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface Mail {
	to: string;
	subject: string;
	html: string;
	/** Plain-text body, for clients that do not render HTML and for the dev log. */
	text: string;
}

/**
 * Sends email. Through Resend's HTTP API when `RESEND_API_KEY` is set — no SDK, one fetch —
 * otherwise it logs the plain-text body so a developer can follow the link.
 *
 * Callers never learn whether delivery worked: a password reset must answer the same way
 * whether or not an account exists, so a send failure is logged, not thrown.
 */
@Injectable()
export class MailService {
	private readonly logger = new Logger(MailService.name);

	constructor(private readonly configService: ConfigService) {}

	get configured(): boolean {
		return Boolean(this.configService.get<string>("mail.resendApiKey"));
	}

	async send(mail: Mail): Promise<void> {
		const key = this.configService.get<string>("mail.resendApiKey");
		if (!key) {
			this.logger.warn(
				`RESEND_API_KEY is not set; not sending "${mail.subject}" to ${mail.to}:\n${mail.text}`
			);
			return;
		}
		try {
			const response = await fetch("https://api.resend.com/emails", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${key}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					from: this.configService.get<string>("mail.from"),
					to: [mail.to],
					subject: mail.subject,
					html: mail.html,
					text: mail.text,
				}),
			});
			if (!response.ok) {
				this.logger.error(
					`Resend refused "${mail.subject}" (${response.status}): ${await response.text()}`
				);
			}
		} catch (error) {
			this.logger.error(
				`Sending "${mail.subject}" failed: ${error instanceof Error ? error.message : error}`
			);
		}
	}
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
