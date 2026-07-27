package com.fishnote.price;

import java.time.OffsetDateTime;

/** Public price read projection. Deliberately excludes rawText and other import-only fields. */
public interface PriceRow {

    OffsetDateTime getObservedAt();

    int getPriceMinKrw();

    int getPriceMaxKrw();

    String getUnit();

    String getOrigin();

    String getSizeGrade();

    String getSourceName();

    String getCondition();
}
