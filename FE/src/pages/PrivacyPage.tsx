import InfoPageLayout, { InfoSection } from '../components/InfoPageLayout';
import { usePageMeta } from '../hooks/usePageMeta';

export default function PrivacyPage() {
  usePageMeta('개인정보처리방침');

  return (
    <InfoPageLayout
      eyebrow="시행일 2026년 8월 6일"
      title="개인정보처리방침"
      description="FishNote는 도감 저장과 후기 기능 제공에 필요한 최소한의 정보만 처리합니다."
    >
      <InfoSection title="수집하는 정보">
        <ul>
          <li>이메일 회원가입: 이메일, 닉네임, 암호화된 비밀번호</li>
          <li>카카오 로그인: 카카오 서비스 사용자 식별자, 닉네임, 제공에 동의한 경우 이메일</li>
          <li>후기 작성: 닉네임, 후기 내용, 별점, 선택한 사진</li>
          <li>먹어본 기록: 횟감, 먹은 날짜·방식, 별점, 선택 입력한 장소·메모·사진</li>
          <li>서비스 보호: 접속 IP, 요청 시각 등 제한적인 접속 기록</li>
          <li>비회원 저장 기능: 횟감 식별 번호를 이용자의 브라우저에만 저장</li>
        </ul>
      </InfoSection>

      <InfoSection title="이용 목적과 보관 기간">
        <ul>
          <li>계정 정보는 로그인, 저장한 도감 동기화, 회원 후기와 먹어본 기록 관리에 이용하며 회원 탈퇴 시 삭제합니다.</li>
          <li>먹어본 기록은 작성한 회원에게만 제공되며, 회원 탈퇴 시 기록과 첨부 사진을 삭제 대상으로 전환합니다.</li>
          <li>카카오 액세스·리프레시 토큰은 로그인 처리 후 저장하지 않습니다.</li>
          <li>회원 탈퇴 시 기존 후기는 작성자 정보와 분리되어 익명으로 남을 수 있으며, 계정 삭제 전에 직접 삭제할 수 있습니다.</li>
          <li>접속 기록은 서비스 보호와 장애 분석 목적에 필요한 기간만 보관합니다.</li>
        </ul>
      </InfoSection>

      <InfoSection title="외부 서비스 이용">
        <p>서비스 운영을 위해 Vercel(웹 제공), Render(서버 운영), Neon(데이터베이스), Cloudinary(후기·먹어본 기록 이미지 저장)를 이용할 수 있습니다.</p>
      </InfoSection>

      <InfoSection title="이용자의 권리">
        <p>로그인 후 계정 관리 화면에서 회원 탈퇴를 요청할 수 있습니다. 별도의 개인정보 문의 채널도 서비스 안에 안내할 예정입니다.</p>
      </InfoSection>

      <InfoSection title="안전한 처리">
        <p>비밀번호는 원문으로 저장하지 않으며 단방향 해시로 처리합니다. 전송 구간은 HTTPS를 사용하고, 서비스 접근 권한을 최소화합니다.</p>
      </InfoSection>
    </InfoPageLayout>
  );
}
