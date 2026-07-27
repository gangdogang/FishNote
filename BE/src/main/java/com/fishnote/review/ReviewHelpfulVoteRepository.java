package com.fishnote.review;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewHelpfulVoteRepository
        extends JpaRepository<ReviewHelpfulVote, Long>, ReviewHelpfulVoteAtomicOperations {
}
