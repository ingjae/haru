function desktopCredential(data){
  if(data?.web)throw Error('웹 애플리케이션용 JSON입니다. Google Cloud에서 OAuth 클라이언트 유형을 데스크톱 앱으로 만들어 다운로드해 주세요.');
  if(typeof data?.installed?.client_id!=='string'||typeof data?.installed?.client_secret!=='string'||!data.installed.client_id||!data.installed.client_secret)throw Error('Google Cloud의 데스크톱 앱 OAuth 클라이언트 JSON이 필요합니다. Calendar 일정 내보내기 파일은 사용할 수 없습니다.');
  return {client_id:data.installed.client_id,client_secret:data.installed.client_secret};
}
function authError(code){
  return ({invalid_client:'OAuth 클라이언트가 유효하지 않습니다. 데스크톱 앱 JSON을 다시 다운로드해 주세요.',invalid_grant:'Google 인증이 만료되거나 취소되었습니다. 다시 로그인해 주세요.',access_denied:'Google 접근이 거부되었습니다. OAuth 동의 화면의 테스트 사용자와 조직의 앱 접근 정책을 확인해 주세요.',redirect_uri_mismatch:'OAuth 클라이언트 유형과 리디렉션 설정이 맞지 않습니다. 데스크톱 앱 JSON을 사용해 주세요.'})[code]||'Google 인증에 실패했습니다. Calendar API 활성화와 OAuth 테스트 사용자 설정을 확인해 주세요.';
}
module.exports={desktopCredential,authError};
