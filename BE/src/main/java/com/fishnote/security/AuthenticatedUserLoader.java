package com.fishnote.security;

import com.fishnote.user.UserRepository;
import java.util.List;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AuthenticatedUserLoader {

    private final UserRepository userRepository;

    public AuthenticatedUserLoader(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public UsernamePasswordAuthenticationToken load(Long userId) {
        return userRepository.findById(userId)
                .map(user -> new UsernamePasswordAuthenticationToken(
                        user.getId(),
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))))
                .orElse(null);
    }
}
