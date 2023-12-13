import React, { useState } from "react";
import "./Modal.css";

const BASEURL = "https://storage.googleapis.com/quantum-engine-public";

const Modal = ({ listening, mode }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [language, setLanguage] = useState(mode);

  const showModal = () => {
    setIsModalVisible(true);
  };

  const hideModal = () => {
    setIsModalVisible(false);
  };

  const toggleModal = () => {
    setIsModalVisible(!isModalVisible);
  };

  const det = (e) => {
    return e === language ? "_selected" : "";
  };

  const langdet = () => {
    return language === "en"
      ? "English"
      : language === "cn"
      ? "中文"
      : language === "jp"
      ? "日本語"
      : "한국어";
  };

  const supportedMap = () => {
    return language == "en"
      ? "The following actions are currently supported by OS2:"
      : language == "cn"
      ? "OS2目前支持以下操作："
      : language == "jp"
      ? "OS2は現在以下の操作をサポートしています："
      : "OS2는 현재 다음과 같은 작업을 지원합니다:";
  };

  const actionsMap = () => {
    return language == "en" ? (
      <ul>
        <li>Play music on Spotify, including your liked songs</li>
        <li>Provide help and information for daily life questions</li>
        <li>Search for up-to-date, localized information on the web</li>
        <li>Look up stock price and weather of a location</li>
        <li>Change voice to a feminine or masculine form</li>
        <li>Change its name and the name you'd like for it to call you</li>
        <li>
          Clear past conversations by saying "Clear past conversations" or
          "Forget about past conversations"
        </li>
      </ul>
    ) : language == "cn" ? (
      <ul>
        <li>在Spotify上播放音乐，包括您喜欢的歌曲</li>
        <li>提供日常生活问题的帮助和信息</li>
        <li>在网上搜索最新的、本地化的信息</li>
        <li>查找股票价格和某个地区的天气</li>
        <li>将声音改为女性或男性形式</li>
        <li>更改其名称以及您希望它称呼您的名称</li>
        <li>通过说“清除过去的对话”或“忘记过去的对话”来清除过去的对话</li>
      </ul>
    ) : language == "jp" ? (
      <ul>
        <li>Spotifyで音楽を再生する（好きな曲も含む）</li>
        <li>日常生活の質問に対する助けや情報提供</li>
        <li>ウェブ上で最新のローカライズされた情報を検索する</li>
        <li>株価と場所の天気を調べる</li>
        <li>声を女性的または男性的な形に変える</li>
        <li>自分の名前と呼びたい名前を変更する</li>
        <li>
          「過去の会話を消去する」または「過去の会話について忘れる」と言って過去の会話を消去する
        </li>
      </ul>
    ) : (
      <ul>
        <li>Spotify에서 음악 재생, 좋아하는 노래 포함</li>
        <li>일상생활 질문에 도움과 정보 제공</li>
        <li>웹에서 최신 지역화 정보 검색</li>
        <li>주식 가격 및 위치의 날씨 조회</li>
        <li>목소리를 여성형이나 남성형으로 바꾸기</li>
        <li>이름 변경 및 사용자가 원하는 이름으로 불러주기</li>
        <li>
          "과거 대화 지우기" 또는 "과거 대화 잊어버리기"라고 말하면 과거 대화
          기록 삭제
        </li>
      </ul>
    );
  };

  const sentenceTwoMap = () => {
    return language == "en"
      ? "OS2 is a social experiment to demonstrate how we will soon interact with natural language interfaces powered by AI. Through simulating this new relationship between humans and machines, we hope to better understand how this will affect the future of social interactions. OS2 will be temporarily available for the purpose of researching this phenomenon of society & non-invasively monitored. Anything the AI system expresses does not reflect the values & opinions of those who created it. When using OS2 please understand that you are interacting with an experimental interface."
      : language == "cn"
      ? "OS2是一个社会实验，旨在展示我们将如何与由AI驱动的自然语言界面互动。通过模拟人类与机器之间的新关系，我们希望更好的理解这项技术对于未来社交互动的影响。为此，我们将暂时开放OS2的权限，并对互动过程进行非侵入式的监测。AI系统表达的任何内容都不代表创建它的人的价值观和观点。在使用OS2时，请理解您正在与一个实验性界面互动。"
      : language == "jp"
      ? "OS2は、AIによって駆動される自然言語インターフェースとどのようにやがて交流するかを示す社会実験です。人間と機械の間の新しい関係をシミュレートすることで、社会交流の未来にどのような影響があるかをよりよく理解することを目指しています。OS2は、社会現象の研究目的で一時的に利用可能になり、侵襲的でない監視が行われます。AIシステムが表現するものは、それを作成した人々の価値観や意見を反映していません。OS2を使用する際には、実験的なインターフェースと交流していることを理解してください。"
      : "OS2는 인공지능으로 구동되는 자연어 인터페이스와 어떻게 상호 작용할 것인지를 보여주기 위한 사회 실험입니다. 인간과 기계 간의 새로운 관계를 시뮬레이션함으로써, 이것이 앞으로의 사회 상호 작용에 어떤 영향을 미칠지 더 잘 이해하고자 합니다. OS2는 이러한 사회 현상을 연구하기 위해 일시적으로 사용 가능하며, 비침습적으로 모니터링됩니다. 인공지능 시스템이 표현하는 것은 그것을 창조한 사람들의 가치와 의견을 반영하지 않습니다. OS2를 사용할 때 실험적 인터페이스와 상호 작용한다는 것을 이해해주시길 바랍니다.";
  };

  const sentenceThreeMap = () => {
    return language == "en"
      ? "The existing foundation model and large language model interactions are tied to slow, synchronous text interfaces, while traditional real-time services, from video meetings to game servers, are rarely connected to current-generation AI. OS2, powered by Quantum Engine, combines the best of both worlds by enabling natural language voice-based intelligence at the speed of thought. Augmented by various techniques in the literature, OS2 can also retain long-term memory of past conversations without sacrificing response time."
      : language == "cn"
      ? "现有的基础模型和大型语言模型的交互逻辑依赖于缓慢的同步文本界面，而传统的实时服务，从视频会议到游戏服务器，则很少接入前沿 AI 技术。由量子引擎 (Quantum Engine) 驱动的 OS2，将这两种技术的优势相结合，以实现以思维速度进行的自然语言语音智能。通过应用最新文献中的各种技术，OS2 还可以在不牺牲响应时间的情况下保留过去对话的长期记忆。"
      : language == "jp"
      ? "既存のファンデーションモデルや大規模言語モデルの相互作用は、遅い同期テキストインターフェースに結びついている一方で、従来のリアルタイムサービス（ビデオ会議からゲームサーバーまで）は、現行世代のAIにはほとんど接続されていません。OS2はQuantum Engine（量子エンジン）によって駆動され、自然言語による音声ベースのインテリジェンスを思考の速さで実現することで、両方の世界の良いところを組み合わせています。文献のさまざまな技法によって補強されたOS2は、応答時間を犠牲にすることなく、過去の会話の長期記憶を保持することもできます。"
      : "기존의 기반 모델과 대형 언어 모델 상호 작용은 느린 동기 텍스트 인터페이스에 연결되어 있으며, 비디오 회의에서 게임 서버에 이르기까지 전통적인 실시간 서비스는 현재 세대 AI에 거의 연결되어 있지 않습니다. OS2는 Quantum Engine (양자 엔진)을 통해 이 두 가지의 장점을 결합하여 생각의 속도로 자연어 음성 기반 지능을 가능하게 합니다. 문헌에서 소개된 다양한 기법으로 향상된 OS2는 대화의 장기 기억을 유지할 수 있으면서도 응답 시간을 희생하지 않습니다.";
  };

  const jump = () => {
    if (language === mode) {
      return toggleModal();
    } else {
      window.location.href = "/webapp/" + language;
    }
  };

  //<img
  //  height={20}
  //  onClick={() => setLanguage("cn")}
  //  style={{ cursor: "pointer", margin: 5 }}
  //  src={BASEURL + "/buttons/Button_中文" + det("cn") + ".png"}
  //></img>
  //<img
  //  height={20}
  //  onClick={() => setLanguage("jp")}
  //  style={{ cursor: "pointer", margin: 5 }}
  //  src={BASEURL + "/buttons/Button_日本語" + det("jp") + ".png"}
  //></img>
  //<img
  //  height={20}
  //  onClick={() => setLanguage("kr")}
  //  style={{ cursor: "pointer", margin: 5 }}
  //  src={BASEURL + "/buttons/Button_한국어" + det("kr") + ".png"}
  //></img>
  // {!isModalVisible && (
  //  <img
  //  onClick={toggleModal}
  //  style={{
  //    cursor: "help",
  //  }}
  //  width={20}
  //  height={20}
  //  src={BASEURL + "/info_white.png"}
  //></img>
  //)}
  
  return (
    <div
      style={{
        width: isModalVisible ? "55%" : "",
        height: isModalVisible ? "90%" : "",
        cursor: isModalVisible ? "" : "default",
        backgroundColor: "#000000",
        transition: "background-color 0.5s linear",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        margin: "auto",
        zIndex: 1,
        position: "absolute",
        bottom: "2%",
        padding: "5px",
      }}
    >
      {isModalVisible && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "left",
            height: "60%",
            width: "100%",
          }}
        >
          <img
            src={BASEURL + "/Logo_OS2_QE_Grey.png"}
            style={{
              width: "40vw",
              maxWidth: "375px",
              marginBottom: 30,
            }}
          />
          <div className="textbox-modal">
            <span>{supportedMap()}</span>
            <br /> <br />
            {actionsMap()}
            <br />
            <span>{sentenceTwoMap()}</span>
            <br /> <br />
            <span>{sentenceThreeMap()}</span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 20,
              maxWidth: "100%",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                width: "80%",
                flexWrap: "wrap",
              }}
            >
              <img
                height={20}
                onClick={() => setLanguage("en")}
                style={{ cursor: "pointer", margin: 5 }}
                src={BASEURL + "/buttons/Button_english" + det("en") + ".png"}
              ></img>
            </div>
            <img
              height={20}
              onClick={jump}
              style={{ cursor: "pointer", margin: 5 }}
              src={BASEURL + "/buttons/button_Confirm_" + langdet() + ".png"}
            ></img>
          </div>
        </div>
      )}
    </div>
  );
};

export default Modal;
