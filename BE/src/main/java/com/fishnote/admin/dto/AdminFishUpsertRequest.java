package com.fishnote.admin.dto;

import com.fishnote.fish.FishCategory;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public record AdminFishUpsertRequest(
        @NotBlank(message = "이름은 필수입니다.")
        @Size(max = 100, message = "이름은 100자 이하여야 합니다.")
        String name,

        @Size(max = 100, message = "영문명은 100자 이하여야 합니다.")
        String nameEn,

        @NotBlank(message = "슬러그는 필수입니다.")
        @Size(max = 120, message = "슬러그는 120자 이하여야 합니다.")
        @Pattern(
                regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$",
                message = "슬러그는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.")
        String slug,

        @NotNull(message = "분류는 필수입니다.")
        FishCategory category,

        @Size(max = 150, message = "학명은 150자 이하여야 합니다.")
        String scientificName,

        @Size(max = 2048, message = "이미지 URL은 2048자 이하여야 합니다.")
        String imageUrl,

        @Size(max = 5000, message = "맛 설명은 5000자 이하여야 합니다.")
        String tasteDesc,

        @Min(value = 1, message = "가격 단계는 1 이상이어야 합니다.")
        @Max(value = 3, message = "가격 단계는 3 이하여야 합니다.")
        Short priceLevel,

        boolean featured,

        @Size(max = 5000, message = "소개는 5000자 이하여야 합니다.")
        String description,

        @Size(max = 12, message = "제철 월은 12개 이하여야 합니다.")
        List<@Min(1) @Max(12) Short> seasonMonths,

        @Size(max = 20, message = "맛 태그는 20개 이하여야 합니다.")
        List<@NotBlank @Size(max = 30) String> tasteTags,

        @Size(max = 20, message = "팁은 20개 이하여야 합니다.")
        List<@NotBlank @Size(max = 1000) String> tips,

        @Size(max = 30, message = "별칭은 30개 이하여야 합니다.")
        List<@NotBlank @Size(max = 100) String> aliases
) {
}
