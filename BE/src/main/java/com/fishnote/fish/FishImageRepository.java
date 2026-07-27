package com.fishnote.fish;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FishImageRepository extends JpaRepository<FishImage, Long> {

    List<FishImage> findAllByFishIdOrderByImageOrder(Long fishId);
}
