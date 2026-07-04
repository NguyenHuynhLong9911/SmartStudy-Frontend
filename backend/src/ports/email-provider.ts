export interface VerificationEmailInput {
  readonly recipientName?: string;
  readonly to: string;
  readonly verificationUrl: string;
}

export interface IEmailProvider {
  sendVerificationEmail(input: VerificationEmailInput): Promise<void>;
}
