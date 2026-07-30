import InfoPageLayout, { InfoSection } from '../components/InfoPageLayout';
import { usePageMeta } from '../hooks/usePageMeta';

export default function SourcesPage() {
  usePageMeta('정보 출처', 'FishNote 횟감·제철·맛 정보의 검수 기준과 출처를 안내합니다.');

  return (
    <InfoPageLayout
      eyebrow="정보를 다루는 원칙"
      title="정보 출처"
      description="제철은 산지, 수온, 유통 방식에 따라 달라질 수 있습니다. FishNote는 하나의 정답처럼 단정하지 않고 공공기관 자료와 시장 정보를 교차 확인합니다."
    >
      <InfoSection title="월별 제철을 정하는 법">
        <p>
          각 어종에 대표 제철 월을 등록하고, 해양수산부 ‘이달의 수산물’처럼 공개된 공공기관 지정 이력과
          교차 확인합니다. 오늘의 수온·어획량·시장 가격을 실시간으로 계산한 값은 아닙니다.
        </p>
        <p className="mt-2.5">
          자연산 계절 어종은 여러 해의 지정 월을 근거로 활용하지만, 양식·연중 공급 어종의 소비 촉진 지정 월은
          제철 근거로 그대로 사용하지 않습니다.
        </p>
      </InfoSection>

      <InfoSection title="공개한 원문">
        <ul>
          {PUBLIC_SOURCES.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title}
              </a>
              {' — '}{source.fishName}, {source.publisher}, {source.publishedAt}
            </li>
          ))}
        </ul>
        <p>위 자료는 원문에 표시된 공공누리 제1유형(출처표시) 조건을 함께 기록하고 있습니다.</p>
      </InfoSection>

      <InfoSection title="검수 상태를 읽는 법">
        <p>
          ‘검증 완료’는 해당 주장에 신뢰도 높은 원문이 연결된 상태, ‘일부 검증’은 참고 가능한 근거만 있는 상태,
          ‘검증 전’은 아직 공개할 원문이 없는 상태입니다. 상세 화면에서는 제철·맛·가격처럼 주장별로 상태와 최근 검수일을 따로 표시합니다.
          전체 요약은 다섯 주장 모두 검증됐을 때만 ‘검증 완료’로 표시합니다.
        </p>
      </InfoSection>

      <InfoSection title="표현과 사진 원칙">
        <ul>
          <li>제철 월과 학명 같은 사실은 출처를 확인하고, 설명 문장은 FishNote가 직접 작성합니다.</li>
          <li>사진은 이용 조건을 확인한 자료 또는 직접 촬영한 이미지만 사용합니다.</li>
          <li>어종을 오인할 가능성이 있는 이미지는 사진 대신 중립적인 표시를 사용합니다.</li>
        </ul>
      </InfoSection>

      <InfoSection title="정보 제보">
        <p>
          표준명 혼동이나 제철·맛·가격·사진 오류는 각 횟감 상세 화면의 ‘정보 오류 제보’에서 알려주세요.
          이메일이나 이름은 받지 않으며, 확인이 필요한 내용과 선택적인 공개 원문 URL만 접수합니다.
        </p>
      </InfoSection>
    </InfoPageLayout>
  );
}

const PUBLIC_SOURCES = [
  {
    fishName: '전어',
    publisher: '인천광역시 수산자원연구소',
    title: '2024년 9월, 어식백세 수산물 “대하, 전어”',
    url: 'https://www.incheon.go.kr/fish/FI020401/2207048',
    publishedAt: '2024년 9월 11일',
  },
  {
    fishName: '갯장어·붕장어',
    publisher: '인천광역시 수산자원연구소',
    title: '2024년 8월, 어식백세 수산물 “장어류, 문어”',
    url: 'https://www.incheon.go.kr/fish/FI020401/2203724',
    publishedAt: '2024년 8월 20일',
  },
  {
    fishName: '농어',
    publisher: '인천광역시 수산자원연구소',
    title: '2020년 6월 어식백세 수산물 “광어, 농어”',
    url: 'https://www.incheon.go.kr/fish/FI020401/2050291',
    publishedAt: '2020년 6월 8일',
  },
  {
    fishName: '우럭(조피볼락)',
    publisher: '인천광역시 수산자원연구소',
    title: '2026년 5월, 어식백세 수산물 “다시마, 조피볼락”',
    url: 'https://www.incheon.go.kr/fish/FI020401/3070620',
    publishedAt: '2026년 5월 11일',
  },
  {
    fishName: '가자미',
    publisher: '인천광역시 수산자원연구소',
    title: '2026년 4월, 어식백세 수산물 “가자미, 홍어”',
    url: 'https://www.incheon.go.kr/fish/FI020401/3067203',
    publishedAt: '2026년 4월 3일',
  },
  {
    fishName: '도다리',
    publisher: '인천광역시 수산자원연구소',
    title: '2026년 3월, 어식백세 수산물 “도다리, 멍게”',
    url: 'https://www.incheon.go.kr/fish/FI020401/3065118',
    publishedAt: '2026년 3월 7일',
  },
  {
    fishName: '감성돔',
    publisher: '인천광역시 수산자원연구소',
    title: '2024년 10월, 어식백세 수산물 “삼치, 감성돔”',
    url: 'https://www.incheon.go.kr/fish/FI020401/2209903',
    publishedAt: '2024년 9월 30일',
  },
  {
    fishName: '민어',
    publisher: '인천광역시 수산자원연구소',
    title: '2023년 8월, 어식백세 수산물 “민어, 한치”',
    url: 'https://www.incheon.go.kr/fish/FI020401/2142497',
    publishedAt: '2023년 8월 14일',
  },
  {
    fishName: '병어',
    publisher: '인천광역시 수산자원연구소',
    title: '2023년 6월, 어식백세 수산물 “재첩, 병어”',
    url: 'https://www.incheon.go.kr/fish/FI020401/2128808',
    publishedAt: '2023년 6월 10일',
  },
] as const;
