package com.fishnote.correction;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FishCorrectionRequestRepository extends JpaRepository<FishCorrectionRequest, Long> {

    long countByStatus(CorrectionRequestStatus status);

    @EntityGraph(attributePaths = "fish")
    List<FishCorrectionRequest> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);

    @EntityGraph(attributePaths = "fish")
    List<FishCorrectionRequest> findAllByStatusOrderByCreatedAtDescIdDesc(
            CorrectionRequestStatus status,
            Pageable pageable);
}
