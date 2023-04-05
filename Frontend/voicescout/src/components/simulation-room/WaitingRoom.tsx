import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { $ } from "util/axios";
import style from "./WaitingRoom.module.css";
import SockJS from "sockjs-client";
import Stomp from "stompjs";
import { OpenVidu } from "openvidu-browser";
import Acquaintance from "img/type_acquaintance.png";
import Agency from "img/type_agency.png";
import Loans from "img/type_loans.png";
import Victim from "img/victim.png";
import Criminal from "img/criminal.png";
import Mike from "img/mike.png";
import Headset from "img/headset.png";
import Calloff from "img/calloff2.png";
import UpdataModal from "components/common/UpdataModal";

// const socket = new SockJS(`http://localhost:4433/api/webSocket`);
const socket = new SockJS(`https://j8a404.p.ssafy.io/api/webSocket`);
const stompClient = Stomp.over(socket);

export default function WaitingRoom() {
  const { isLoading, data, refetch } = useQuery(
    ["Room"],
    () => $.get(`/rooms/${location.state.seq}`),
    {
      refetchOnMount: "always",
    }
  );

  const navigate = useNavigate();
  const location = useLocation();
  let { params } = useParams();
  const stompClientRef = useRef<Stomp.Client | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [speechToText, setSpeechToText] = useState("");
  const [userType, setUserType] = useState(location.state.userType);
  const [getReady, setGetReady] = useState(false);
  const [isModal, setIsModal] = useState(false);

  const [seq, setSeq] = useState<number>(location.state.seq);
  const [title, setTitle] = useState<string>(location.state.title);
  const [password, setPassword] = useState<string>(location.state.password);
  const [typeId, setTypeId] = useState<number>(location.state.typeId);
  const [link, setLink] = useState<string>(location.state.link);
  const [participant, setParticipant] = useState<number>(
    location.state.participant
  );
  const [locked, setLocked] = useState<boolean>(location.state.locked);
  const [update, setUpdate] = useState<number>(0);

  // OpenVIdu용 변수
  const [session, setSession] = useState<any>(null);
  const [publisher, setPublisher] = useState<any>(null);

  const info = [
    {
      type: `대출 사칭형`,
      describe: `금융기관을 사칭, 피싱사이트로 유인하여
      피해자 명의로 대출 편취하는 사기 수법`,
      img: Loans,
    },
    {
      type: `기관 사칭형`,
      describe: `수사기관을 사칭하여 피해자를 기망하여
       금전 편취하는 사기 수법`,
      img: Agency,
    },
    {
      type: `지인 사칭형`,
      describe: `지인을 사칭해 문자나 전화로 돈을 요구하는
      사기 수법`,
      img: Acquaintance,
    },
  ];

  interface datas_type {
    seq: number;
    title: string;
    password: string;
    typeId: number;
    link: string;
    participant: number;
    locked: boolean;
  }

  const datas: datas_type = {
    seq: seq,
    title: title,
    password: password,
    typeId: typeId,
    link: link,
    participant: participant,
    locked: locked,
  };

  const init = (arr: datas_type) => {
    setTitle(arr.title);
    setLocked(arr.locked);
    setParticipant(arr.participant);
    setPassword(arr.password);
    setTypeId(arr.typeId);
  };

  const res_delete = () => {
    return $.delete(`/rooms/${location.state.seq}`);
  };
  const { mutate: onDelete } = useMutation(res_delete, {
    onSuccess: () => {
      navigate(`/simulation-list/`);
    },
  });

  const res_put = () => {
    return $.put(`/rooms`, datas);
  };

  // 방에 남아있는 사람 0명이면 자동으로 방 삭제
  const { mutate: onChange } = useMutation(res_put);

  // 웹소켓와 음성인식 이벤트
  useEffect(() => {
    window.SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    stompClient.connect({}, () => {
      console.log("Connected to WebSocket server");

      // get-out send하면 모두 페이지에서 나가기
      stompClient.subscribe(`/ai/${link}`, (data) => {
        const newMsg = JSON.parse(data.body);
        if (newMsg.prediction === 2) {
          if (userType === 1) navigate(`/simulation-list/`);
          else onDelete();
        } else if (newMsg.prediction === 3) {
          window.location.replace(`/simulation-room/${link}`);
        }
      });
    });

    const recognition = new SpeechRecognition();

    recognition.interimResults = true;
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.maxAlternatives = 10000;

    recognition.addEventListener("result", (e) => {
      console.log("음성인식 테스트중");
      for (let i = e.resultIndex; i < e.results.length; i++) {
        let transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          setSpeechToText(() => {
            const message = transcript;
            console.log(`Sending "${message}" to server via WebSocket`);
            stompClient.send(
              "/ai",
              {},
              JSON.stringify({ message: message, link: link })
            );
            return message;
          });
        }
      }
    });

    recognition.addEventListener("end", recognition.start);

    recognition.start();
    recognitionRef.current = recognition;

    return () => {
      stompClient.disconnect(() => {
        console.log("Disconnected from WebSocket server");
      });
    };
  }, []);

  // 방 나갈때 보내는 통신
  const getOut = () => {
    stompClient.send(
      "/ai",
      {},
      JSON.stringify({ message: "get-out", link: link })
    );
  };

  // 방 정보 변경시 방에있는 사람 모두 새로고침
  const updateRoom = () => {
    stompClient.send(
      "/ai",
      {},
      JSON.stringify({ message: "update-room", link: link })
    );
  };

  if (update === 1) {
    updateRoom();
    setUpdate(0);
  }

  // OpenVidu 셋팅

  // GET요청 성공 시 데이터 로드
  useEffect(() => {
    if (isLoading) return;
    refetch();
    init(data && data.data);
  }, [isLoading]);

  return (
    <>
      {!getReady && !isLoading && (
        <>
          <div className={style.header}>{title}</div>
          <div className={style.header_guide}>역할을 선택하십시오</div>
          <div className={style.contents}>
            <img
              className={style.contents_first}
              src={info[typeId].img}
              alt=""
            />
            <div className={style.contents_second}>
              <p>{info[typeId].type}</p>
              <div className={style.locked}>
                {locked ? <span>비공개</span> : <span>공개</span>}
              </div>
            </div>
            <div className={style.contents_third}>{info[typeId].describe}</div>
          </div>
          <div className={style.information}>
            <div className={style.blank}></div>
            <img className={style.my_img} src={Victim} alt="" />
            <img className={style.your_img} src={Criminal} alt="" />
            <div className={style.roles}>
              <div className={style.main_role}>피해자</div>
              <div className={style.sub_role}>피싱범</div>
            </div>
            <div className={style.settings}>
              <img src={Mike} alt="" />
              <img src={Headset} alt="" />
            </div>
          </div>
          <div className={style.btn_div}>
            <button
              className={style.setting_btn}
              onClick={() => {
                setIsModal(true);
                setUpdate(0);
              }}
            >
              설정
            </button>
            <button
              className={style.start_btn}
              onClick={() => {
                setGetReady(true);
              }}
            >
              시작
            </button>
            <button
              className={style.out_btn}
              onClick={() => {
                if (userType === 0) getOut();
                else {
                  setParticipant(participant - 1);
                  onChange();
                  navigate(`/simulation-list/`);
                }
              }}
            >
              나가기
            </button>
          </div>
        </>
      )}
      {getReady && (
        <>
          <div className={style.role}>
            <div className={style.simul_type}>
              <img
                className={style.contents_first}
                src={info[location.state.typeId].img}
                alt=""
              />
              <p>{info[location.state.typeId].type}</p>
            </div>
            <div className={style.simul_call}>
              {info[location.state.typeId].type === "대출 사칭형"
                ? "1301"
                : info[location.state.typeId].type === "기관 사칭형"
                ? "1599-9999"
                : "지인"}
            </div>
            <div className={style.simul_timer}>00:21</div>
            <div className={style.simul_profile}>
              <img className={style.simul_role} src={Criminal} alt="" />
            </div>
            <div className={style.simul_calloff}>
              <img
                className={style.simul_callimg}
                src={Calloff}
                alt=""
                onClick={() => {
                  navigate(`/simulation-list/`);
                }}
              />
            </div>
          </div>
        </>
      )}
      {isModal && (
        <UpdataModal
          setIsModal={setIsModal}
          setUpdate={setUpdate}
          seqInput={seq}
          titleInput={title}
          passwordInput={password}
          typeIdInput={typeId}
          linkInput={link}
          participantInput={participant}
          lockedInput={locked}
        />
      )}
    </>
  );
}
