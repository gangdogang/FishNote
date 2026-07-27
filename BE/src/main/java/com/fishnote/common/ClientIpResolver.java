package com.fishnote.common;

import jakarta.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Resolves one stable client address without trusting caller-controlled forwarding headers.
 *
 * <p>{@code X-Forwarded-For} is considered only when the immediate peer belongs to an
 * explicitly configured trusted proxy range. The chain is then walked from right to left so
 * an address prepended by a client cannot replace the address appended by the trusted edge.</p>
 */
@Component
public class ClientIpResolver {

    private static final Logger log = LoggerFactory.getLogger(ClientIpResolver.class);
    private static final int MAX_FORWARDED_HEADER_LENGTH = 2_048;
    private static final int MAX_FORWARDED_HOPS = 32;
    private static final Pattern NUMERIC_IPV6 = Pattern.compile("[0-9a-fA-F:.]+");
    private static final Pattern PORT = Pattern.compile("[0-9]{1,5}");

    private final List<IpAddressMatcher> trustedProxies;

    public ClientIpResolver(
            @Value("${app.client-ip.trusted-proxies:}") String trustedProxyCidrs) {
        this.trustedProxies = parseTrustedProxies(trustedProxyCidrs);
        if (this.trustedProxies.isEmpty()) {
            log.warn("신뢰 프록시가 설정되지 않아 X-Forwarded-For를 무시합니다. "
                    + "운영 프록시 확인 후 APP_CLIENT_IP_TRUSTED_PROXIES를 설정하세요.");
        }
    }

    public String resolve(HttpServletRequest request) {
        String remoteAddress = normalizeIp(request.getRemoteAddr()).orElse("unknown");
        if (!isTrustedProxy(remoteAddress)) {
            return remoteAddress;
        }

        String forwarded = singleForwardedHeader(request).orElse(null);
        if (!StringUtils.hasText(forwarded)
                || forwarded.length() > MAX_FORWARDED_HEADER_LENGTH) {
            return remoteAddress;
        }

        String[] hops = forwarded.split(",", -1);
        if (hops.length == 0 || hops.length > MAX_FORWARDED_HOPS) {
            return remoteAddress;
        }

        List<String> normalizedHops = new ArrayList<>(hops.length);
        for (String hop : hops) {
            Optional<String> normalized = normalizeIp(hop);
            if (normalized.isEmpty()) {
                return remoteAddress;
            }
            normalizedHops.add(normalized.get());
        }

        for (int index = normalizedHops.size() - 1; index >= 0; index--) {
            String candidate = normalizedHops.get(index);
            if (!isTrustedProxy(candidate)) {
                return candidate;
            }
        }
        return remoteAddress;
    }

    private Optional<String> singleForwardedHeader(HttpServletRequest request) {
        Enumeration<String> values = request.getHeaders("X-Forwarded-For");
        if (values == null || !values.hasMoreElements()) {
            return Optional.empty();
        }
        String value = values.nextElement();
        // A verified edge must normalize the chain into one field. Multiple fields are
        // ambiguous (client-supplied first field + edge-appended second field), so fail closed.
        if (values.hasMoreElements()) {
            return Optional.empty();
        }
        return Optional.ofNullable(value);
    }

    private boolean isTrustedProxy(String address) {
        for (IpAddressMatcher matcher : trustedProxies) {
            try {
                if (matcher.matches(address)) {
                    return true;
                }
            } catch (IllegalArgumentException ignored) {
                // IPv4 and IPv6 matchers reject addresses from the other family.
            }
        }
        return false;
    }

    private static List<IpAddressMatcher> parseTrustedProxies(String configuredCidrs) {
        if (!StringUtils.hasText(configuredCidrs)) {
            return List.of();
        }

        List<IpAddressMatcher> matchers = new ArrayList<>();
        for (String rawCidr : configuredCidrs.split(",", -1)) {
            String cidr = rawCidr.trim();
            if (cidr.isEmpty()) {
                throw new IllegalArgumentException("신뢰 프록시 CIDR에 빈 항목이 있습니다.");
            }
            validateNumericCidr(cidr);
            try {
                matchers.add(new IpAddressMatcher(cidr));
            } catch (IllegalArgumentException ex) {
                throw new IllegalArgumentException("올바르지 않은 신뢰 프록시 CIDR: " + cidr, ex);
            }
        }
        return List.copyOf(matchers);
    }

    private static void validateNumericCidr(String cidr) {
        String[] parts = cidr.split("/", -1);
        if (parts.length > 2 || normalizeIp(parts[0]).isEmpty()) {
            throw new IllegalArgumentException("올바르지 않은 신뢰 프록시 CIDR: " + cidr);
        }
        if (parts[0].startsWith("[")
                || (parts[0].contains(".") && parts[0].contains(":"))) {
            throw new IllegalArgumentException("신뢰 프록시 CIDR에는 포트를 사용할 수 없습니다: " + cidr);
        }
        if (parts.length == 1) {
            return;
        }

        int maximumPrefix = parts[0].contains(":") ? 128 : 32;
        try {
            int prefix = Integer.parseInt(parts[1]);
            if (prefix <= 0 || prefix > maximumPrefix) {
                throw new IllegalArgumentException("올바르지 않은 신뢰 프록시 CIDR: " + cidr);
            }
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("올바르지 않은 신뢰 프록시 CIDR: " + cidr, ex);
        }
    }

    private static Optional<String> normalizeIp(String rawAddress) {
        if (!StringUtils.hasText(rawAddress)) {
            return Optional.empty();
        }

        String address = stripOptionalPort(rawAddress.trim());
        if (address == null) {
            return Optional.empty();
        }
        if (address.indexOf(':') < 0) {
            return normalizeIpv4(address);
        }
        if (!NUMERIC_IPV6.matcher(address).matches()) {
            return Optional.empty();
        }

        try {
            InetAddress parsed = InetAddress.getByName(address);
            return Optional.of(parsed.getHostAddress());
        } catch (UnknownHostException ex) {
            return Optional.empty();
        }
    }

    private static String stripOptionalPort(String rawAddress) {
        if (rawAddress.startsWith("[")) {
            int closingBracket = rawAddress.indexOf(']');
            if (closingBracket < 0) {
                return null;
            }
            String suffix = rawAddress.substring(closingBracket + 1);
            if (!suffix.isEmpty() && !validPortSuffix(suffix)) {
                return null;
            }
            return rawAddress.substring(1, closingBracket);
        }

        int firstColon = rawAddress.indexOf(':');
        if (firstColon > 0
                && firstColon == rawAddress.lastIndexOf(':')
                && rawAddress.substring(0, firstColon).contains(".")) {
            String suffix = rawAddress.substring(firstColon);
            if (!validPortSuffix(suffix)) {
                return null;
            }
            return rawAddress.substring(0, firstColon);
        }
        return rawAddress;
    }

    private static boolean validPortSuffix(String suffix) {
        if (!suffix.startsWith(":")) {
            return false;
        }
        String port = suffix.substring(1);
        if (!PORT.matcher(port).matches()) {
            return false;
        }
        return Integer.parseInt(port) <= 65_535;
    }

    private static Optional<String> normalizeIpv4(String address) {
        String[] octets = address.split("\\.", -1);
        if (octets.length != 4) {
            return Optional.empty();
        }

        int[] values = new int[4];
        for (int index = 0; index < octets.length; index++) {
            String octet = octets[index];
            if (octet.isEmpty() || octet.length() > 3 || !octet.chars().allMatch(Character::isDigit)) {
                return Optional.empty();
            }
            int value = Integer.parseInt(octet);
            if (value > 255) {
                return Optional.empty();
            }
            values[index] = value;
        }
        return Optional.of(values[0] + "." + values[1] + "." + values[2] + "." + values[3]);
    }
}
