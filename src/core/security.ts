import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type HostResolver = (hostname: string) => Promise<string[]>;

export type UrlSecurityOptions = {
  allowPrivateNetwork?: boolean;
  resolve?: HostResolver;
};

const defaultResolve: HostResolver = async (hostname) => {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map(({ address }) => address);
};

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  const [a = 0, b = 0] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIp(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(normalized) === 4) return isPrivateIpv4(normalized);
  if (isIP(normalized) !== 6) return true;

  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/u.test(normalized)) return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    if (isIP(mapped) === 4) return isPrivateIpv4(mapped);

    const [highText, lowText] = mapped.split(":");
    const high = Number.parseInt(highText!, 16);
    const low = Number.parseInt(lowText!, 16);
    const ipv4 = `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`;
    return isPrivateIpv4(ipv4);
  }

  return false;
}

export async function validatePublicUrl(
  input: string,
  options: UrlSecurityOptions = {}
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Private or unsupported URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Private or unsupported URL");
  }

  if (options.allowPrivateNetwork) return url;

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Private or unsupported URL");
  }

  const addresses = isIP(hostname)
    ? [hostname]
    : await (options.resolve ?? defaultResolve)(hostname);
  if (addresses.length === 0 || addresses.some(isPrivateIp)) {
    throw new Error("Private or unsupported URL");
  }

  return url;
}
