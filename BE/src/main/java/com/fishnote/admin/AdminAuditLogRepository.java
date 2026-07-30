package com.fishnote.admin;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, Long> {

    @EntityGraph(attributePaths = "actor")
    List<AdminAuditLog> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);
}
