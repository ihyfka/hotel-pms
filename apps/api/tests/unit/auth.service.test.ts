import { describe, it, expect } from "vitest";
import { authService } from "../../src/modules/auth/auth.service.js";

describe("AuthService", () => {
  it("authenticates known default staff accounts", async () => {
    const res = await authService.login("frontdesk@hotel.com");
    expect(res.token).toBeDefined();
    expect(res.user.role).toBe("front_desk");
    expect(res.user.email).toBe("frontdesk@hotel.com");

    const decoded = authService.verifyToken(res.token);
    expect(decoded.role).toBe("front_desk");
    expect(decoded.email).toBe("frontdesk@hotel.com");
  });

  it("authenticates manager account with manager role", async () => {
    const res = await authService.login("manager@hotel.com");
    expect(res.user.role).toBe("manager");
    const decoded = authService.verifyToken(res.token);
    expect(decoded.role).toBe("manager");
  });

  it("authenticates owner account with owner role", async () => {
    const res = await authService.login("owner@hotel.com");
    expect(res.user.role).toBe("owner");
    const decoded = authService.verifyToken(res.token);
    expect(decoded.role).toBe("owner");
  });
});
