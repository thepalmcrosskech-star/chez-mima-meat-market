import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const associations = JSON.parse(readFileSync("public/.well-known/assetlinks.json", "utf8"));
const association = associations.find((entry: { target: { package_name: string } }) =>
  entry.target.package_name === "com.boucheriechezmima.app",
);

describe("Android certificate association", () => {
  it.each([
    "78:8B:10:C9:E5:21:30:C6:00:C9:6E:E5:D7:A2:E9:34:76:68:76:AB:4A:89:00:00:B3:1B:DE:70:7D:C7:8D:DC",
    "86:5C:F1:EC:B8:2A:2D:09:11:C8:56:24:56:8D:B8:23:32:81:C7:4B:E7:F6:68:7C:28:31:D2:64:B0:88:A7:9A",
    "72:1D:62:88:63:74:7E:67:AD:AB:C6:F9:F6:F7:DC:4F:49:33:CF:8D:80:50:75:6E:21:AB:72:8D:98:29:0F:15",
    "AE:21:AA:0E:59:8B:52:92:A4:C6:72:F7:73:92:C5:E4:0B:AD:3E:08:73:5E:28:77:37:F2:EC:7B:B5:D6:E6:BF",
  ])("authorizes the SHA-256 certificate %s", (fingerprint) => {
    expect(association?.target.sha256_cert_fingerprints).toContain(fingerprint);
    expect(association?.relation).toContain("delegate_permission/common.handle_all_urls");
  });

  it("only includes correctly formatted SHA-256 fingerprints", () => {
    expect(association?.target.sha256_cert_fingerprints.length).toBe(4);
    for (const fingerprint of association.target.sha256_cert_fingerprints) {
      expect(fingerprint).toMatch(/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/);
    }
  });
});