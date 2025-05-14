import { Request, Response } from "express";
import { PhoneVerificationService } from "../services/phone-verification.service";
import { logger } from "../utils/logger";

export class PhoneVerificationController {
  private readonly phoneVerificationService: PhoneVerificationService;

  constructor() {
    this.phoneVerificationService = new PhoneVerificationService();
  }

  sendVerificationCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        res.status(400).json({ error: "Phone number is required" });
        return;
      }

      await this.phoneVerificationService.sendVerificationCode(phoneNumber);
      res.json({ success: true });
    } catch (error: any) {
      logger.error("Error in sendVerificationCode controller:", error);

      if (error.message === "Too many attempts. Please try again later.") {
        res.status(429).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: "Failed to send verification code" });
    }
  };

  verifyCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber, code } = req.body;

      if (!phoneNumber || !code) {
        res.status(400).json({ error: "Phone number and code are required" });
        return;
      }

      const isValid = await this.phoneVerificationService.verifyCode(
        phoneNumber,
        code
      );

      if (!isValid) {
        res.status(400).json({ error: "Invalid verification code" });
        return;
      }

      res.json({ isValid: true });
    } catch (error) {
      logger.error("Error in verifyCode controller:", error);
      res.status(500).json({ error: "Failed to verify code" });
    }
  };
}
