import { expect, test } from "vitest";
import { isYooKassaIp, requestIp } from "./ip";

test("accepts only YooKassa notification addresses", () => {
  for (const ip of ["185.71.76.1", "185.71.77.31", "77.75.153.100", "77.75.156.11", "77.75.156.35", "77.75.154.200", "2a02:5180::1", "::ffff:185.71.76.5"]) {
    expect(isYooKassaIp(ip), ip).toBe(true);
  }
  for (const ip of ["185.71.76.32", "77.75.156.12", "8.8.8.8", "::1", "not an ip", null]) {
    expect(isYooKassaIp(ip), String(ip)).toBe(false);
  }
});

test("takes the client address that Caddy puts first", () => {
  expect(requestIp(new Headers({ "x-forwarded-for": "185.71.76.1, 10.0.0.2" }))).toBe("185.71.76.1");
  expect(requestIp(new Headers())).toBeNull();
});
