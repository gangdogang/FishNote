import InfoPageLayout, { InfoSection } from '../components/InfoPageLayout';
import { usePageMeta } from '../hooks/usePageMeta';

export default function TermsPage() {
  usePageMeta('이용약관');

  return (
    <InfoPageLayout
      eyebrow="시행일 2026년 8월 6일"
      title="이용약관"
      description="FishNote를 안전하고 즐겁게 이용하기 위해 필요한 기본 규칙입니다."
    >
      <InfoSection title="서비스의 목적">
        <p>FishNote는 횟감의 제철, 맛, 가격대와 이용자 후기를 참고할 수 있도록 제공하는 정보 서비스입니다.</p>
      </InfoSection>

      <InfoSection title="정보 이용 시 유의사항">
        <ul>
          <li>제철과 가격은 산지, 수온, 어획 및 유통 상황에 따라 달라질 수 있습니다.</li>
          <li>FishNote의 정보는 구매·섭취 결정을 위한 참고 자료이며 품질이나 안전을 보증하지 않습니다.</li>
          <li>알레르기나 건강 관련 판단은 의료·영양 전문가의 안내를 우선해 주세요.</li>
        </ul>
      </InfoSection>

      <InfoSection title="후기 작성 규칙">
        <ul>
          <li>직접 경험을 바탕으로 작성하고, 타인의 개인정보를 게시하지 않습니다.</li>
          <li>광고, 반복 게시, 비방, 불법 콘텐츠, 서비스와 무관한 내용은 제한되거나 삭제될 수 있습니다.</li>
          <li>업로드한 사진과 글을 게시할 권한이 작성자에게 있어야 합니다.</li>
        </ul>
      </InfoSection>

      <InfoSection title="먹어본 기록">
        <p>먹어본 기록은 로그인한 이용자에게만 보이는 개인 기능입니다. 장소나 메모에 타인의 개인정보를 입력하지 말고, 직접 촬영했거나 사용할 권한이 있는 사진만 올려 주세요.</p>
      </InfoSection>

      <InfoSection title="계정과 서비스 변경">
        <p>이용자는 언제든 회원 탈퇴를 요청할 수 있습니다. 안정적인 운영이나 기능 개선을 위해 서비스 내용이 변경될 수 있으며 중요한 변경은 서비스 내에서 안내합니다.</p>
      </InfoSection>

      <InfoSection title="문의">
        <p>서비스 이용 및 권리 침해를 접수할 수 있는 별도 문의 채널을 준비 중입니다.</p>
      </InfoSection>
    </InfoPageLayout>
  );
}
