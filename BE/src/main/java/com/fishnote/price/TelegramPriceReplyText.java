package com.fishnote.price;

final class TelegramPriceReplyText {

    private TelegramPriceReplyText() {}

    static String completed(TelegramPriceImportResponse response) {
        String sourceNames = response.sourceNames().isEmpty()
                ? "미확인"
                : String.join(", ", response.sourceNames());
        if (response.parsedCount() == 0) {
            return "파싱된 시세가 없습니다.\n가게명과 가격 라인이 포함된 시세표 전체 텍스트를 보내주세요.";
        }
        return "시세 저장 완료\n"
                + "- 파싱: " + response.parsedCount() + "건\n"
                + "- 신규 저장: " + response.savedCount() + "건\n"
                + "- 가게: " + sourceNames + "\n"
                + "가게별로 저장했고, 조회 API에서는 전체 합산 그래프 데이터도 제공합니다.";
    }
}
