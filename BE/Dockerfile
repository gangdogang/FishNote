FROM eclipse-temurin:17-jdk AS build

WORKDIR /app

COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN chmod +x gradlew
RUN ./gradlew dependencies --no-daemon

COPY src ./src
# PostgreSQL Testcontainers는 CI 품질 게이트에서 실행한다. 이미지 빌드 단계에는
# Docker 소켓이 없으므로 검증 task 전체가 아니라 배포 산출물만 생성한다.
RUN ./gradlew clean bootJar --no-daemon

FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=build /app/build/libs/*.jar app.jar

# 컨테이너를 root로 실행하지 않는다
RUN useradd --system --uid 1001 --no-create-home spring
USER spring

EXPOSE 8080

# Render 무료 512MB에서는 heap 외 metaspace, code cache, thread stack과 native buffer도
# 같은 한도를 공유한다. 비율 기반 heap 설정은 Spring/Hibernate 부팅 중 RSS가 512MB를
# 넘을 수 있으므로 각 메모리 영역을 명시적으로 제한하고 저오버헤드 Serial GC를 사용한다.
ENTRYPOINT ["java", "-Xms64m", "-Xmx220m", "-Xss512k", "-XX:MaxMetaspaceSize=128m", "-XX:ReservedCodeCacheSize=48m", "-XX:+UseSerialGC", "-XX:+ExitOnOutOfMemoryError", "-jar", "/app/app.jar"]
