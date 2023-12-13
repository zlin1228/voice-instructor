import React, { useState } from "react";
import "./Unavailable.css";

const BASEURL = "https://storage.googleapis.com/quantum-engine-public";

const Unavailable = ({ listening, mode }) => {
  const [language, setLanguage] = useState(mode);

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


  const messageMap = () => {
    return language == "en" ? (
      "The rabbit server is currently undergoing routine maintenance. We are always working to improve the experience of our products and update them from time to time. Please check back later. If you have any questions, please contact us at info@rabbit.tech."
    ) : language == "cn" ? (
      "rabbit服务器正在进行例行维护。 我们一直致力于不断努力改进我们的产品体验，并不时推送更新，因此请稍后再查看。 如果您有任何疑问，请通过info@rabbit.tech与我们联系"
    ) : language == "jp" ? (
      "rabbitサーバーは定期的なメンテナンスを行っています。製品の使用感を常に向上させるために、時々アップデートを行っています。アップデートの情報については、後ほど再度チェックしてください。質問がありましたら、info@rabbit.techまでお問い合わせください。"
    ) : (
      "rabbit 서버는 정기적인 유지보수를 진행하고 있습니다. 제품의 사용 경험을 지속적으로 개선하기 위해 노력하며, 때때로 업데이트가 이루어집니다. 이에 따라 나중에 확인해 주시기 바랍니다. 궁금한 사항은 info@rabbit.tech로 문의해 주세요."
    );
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

  return (
    <div
      style={{
        width: "55%",
        height: "90%",
        cursor: "",
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
      {(
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "left",
            height: "60%",
            width: "100%",
          }}
        >
          <div className="textbox-unavailable">
            <span>{messageMap()}</span>
            <br />
          </div>
        </div>
      )}
    </div>
  );
};

export default Unavailable;
