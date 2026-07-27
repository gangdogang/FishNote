package com.fishnote.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class ClientIpResolverTest {

    @Test
    void ignoresForwardedHeadersFromAnUntrustedPeer() {
        ClientIpResolver resolver = new ClientIpResolver("10.0.0.0/8");

        assertThat(resolve(resolver, "198.51.100.7", "203.0.113.1"))
                .isEqualTo("198.51.100.7");
        assertThat(resolve(resolver, "198.51.100.7", "192.0.2.250"))
                .isEqualTo("198.51.100.7");
    }

    @Test
    void walksATrustedChainFromTheRightAndIgnoresPrependedSpoofValues() {
        ClientIpResolver resolver = new ClientIpResolver("10.0.0.0/8");

        assertThat(resolve(
                resolver,
                "10.0.0.9",
                "192.0.2.250, 198.51.100.23, 10.0.0.8"))
                .isEqualTo("198.51.100.23");
    }

    @Test
    void acceptsNumericIpv4AndBracketedIpv6WithPorts() {
        ClientIpResolver resolver = new ClientIpResolver("10.0.0.0/8,2001:db8:1::/48");

        assertThat(resolve(resolver, "10.0.0.9", "203.0.113.10:443"))
                .isEqualTo("203.0.113.10");
        assertThat(resolve(resolver, "2001:db8:1::9", "[2001:db8:2::20]:8443"))
                .isEqualTo("2001:db8:2:0:0:0:0:20");
    }

    @Test
    void fallsBackToTheImmediatePeerForMalformedOrExcessiveChains() {
        ClientIpResolver resolver = new ClientIpResolver("10.0.0.0/8");

        assertThat(resolve(resolver, "10.0.0.9", "not-an-ip"))
                .isEqualTo("10.0.0.9");
        assertThat(resolve(resolver, "10.0.0.9", "203.0.113.10,".repeat(33)))
                .isEqualTo("10.0.0.9");
    }

    @Test
    void duplicateForwardedHeaderFieldsFailClosedToTheImmediatePeer() {
        ClientIpResolver resolver = new ClientIpResolver("10.0.0.0/8");
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("10.0.0.9");
        request.addHeader("X-Forwarded-For", "192.0.2.250");
        request.addHeader("X-Forwarded-For", "198.51.100.23");

        assertThat(resolver.resolve(request)).isEqualTo("10.0.0.9");
    }

    @Test
    void rejectsInvalidTrustedProxyConfiguration() {
        assertThatThrownBy(() -> new ClientIpResolver("10.0.0.0/8,"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("빈 항목");
        assertThatThrownBy(() -> new ClientIpResolver("proxy.example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("올바르지 않은");
        assertThatThrownBy(() -> new ClientIpResolver("0.0.0.0/0"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("올바르지 않은");
        assertThatThrownBy(() -> new ClientIpResolver("::/0"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("올바르지 않은");
    }

    private String resolve(ClientIpResolver resolver, String remoteAddress, String forwardedFor) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(remoteAddress);
        request.addHeader("X-Forwarded-For", forwardedFor);
        return resolver.resolve(request);
    }
}
