package com.fishnote.review;

import java.util.Optional;

public interface ReviewHelpfulVoteAtomicOperations {

    Optional<Integer> increaseHelpfulCountAtomically(Long reviewId, String voterKey);
}
