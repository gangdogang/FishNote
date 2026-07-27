package com.fishnote.observability;

import java.util.Locale;

enum SqlOperation {
    SELECT("select"),
    INSERT("insert"),
    UPDATE("update"),
    DELETE("delete"),
    CALL("call"),
    OTHER("other");

    private final String tag;

    SqlOperation(String tag) {
        this.tag = tag;
    }

    String tag() {
        return tag;
    }

    static SqlOperation classify(String sql) {
        if (sql == null) {
            return OTHER;
        }
        String statement = stripLeadingBlockComments(sql);
        int keywordEnd = 0;
        while (keywordEnd < statement.length() && Character.isLetter(statement.charAt(keywordEnd))) {
            keywordEnd++;
        }
        if (keywordEnd == 0) {
            return OTHER;
        }
        return switch (statement.substring(0, keywordEnd).toUpperCase(Locale.ROOT)) {
            case "SELECT" -> SELECT;
            case "INSERT" -> INSERT;
            case "UPDATE" -> UPDATE;
            case "DELETE" -> DELETE;
            case "CALL" -> CALL;
            default -> OTHER;
        };
    }

    private static String stripLeadingBlockComments(String sql) {
        String remaining = sql.stripLeading();
        while (remaining.startsWith("/*")) {
            int commentEnd = remaining.indexOf("*/", 2);
            if (commentEnd < 0) {
                return "";
            }
            remaining = remaining.substring(commentEnd + 2).stripLeading();
        }
        return remaining;
    }
}
