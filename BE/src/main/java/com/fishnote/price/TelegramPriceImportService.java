package com.fishnote.price;

import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class TelegramPriceImportService {

    private final ShopPriceParser parser;
    private final PriceImportPersistenceService persistenceService;
    private final boolean bulkEnabled;

    public TelegramPriceImportService(
            ShopPriceParser parser,
            PriceImportPersistenceService persistenceService) {
        this(parser, persistenceService, true);
    }

    @Autowired
    public TelegramPriceImportService(
            ShopPriceParser parser,
            PriceImportPersistenceService persistenceService,
            @Value("${app.price-import.bulk.enabled:true}") boolean bulkEnabled) {
        this.parser = parser;
        this.persistenceService = persistenceService;
        this.bulkEnabled = bulkEnabled;
    }

    /** Parses before entering the persistence service's transaction. */
    public TelegramPriceImportResponse importText(String text, OffsetDateTime fallbackObservedAt) {
        return importText(text, fallbackObservedAt, null);
    }

    public TelegramPriceImportResponse importText(
            String text,
            OffsetDateTime fallbackObservedAt,
            String replyChatId) {
        List<ParsedShopPrice> parsedRows = parser.parse(text, fallbackObservedAt);
        LinkedHashSet<String> sourceNames = new LinkedHashSet<>();
        parsedRows.stream()
                .map(ParsedShopPrice::sourceName)
                .filter(sourceName -> sourceName != null && !sourceName.isBlank())
                .forEach(sourceNames::add);
        List<String> sources = List.copyOf(sourceNames);
        if (bulkEnabled) {
            return persistenceService.persist(parsedRows, sources, replyChatId);
        }
        return persistenceService.persistLegacy(parsedRows, sources, replyChatId);
    }
}
