import { useRef, useState, useEffect } from "react";
import { Stack } from "@fluentui/react";
import {
  DismissRegular,
  SquareRegular,
  ShieldLockRegular,
  ErrorCircleRegular,
} from "@fluentui/react-icons";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

import styles from "./Chat.module.css";
import MyCityTitle from "../../assets/MyCityTitle.svg";
import UserAvatar from "../../assets/UserAvatar.svg";
import AiAvatar from "../../assets/AiAvatar.svg";
import Conversation from "../../assets/Conversation.svg";

import {
  ChatMessage,
  ConversationRequest,
  conversationApi,
  Citation,
  ToolMessageContent,
  ChatResponse,
  getUserInfo,
} from "../../api";
import { Answer } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { InfoCardList } from "../../components/InfoCardList";

const Chat = () => {
  const lastQuestionRef = useRef<string>("");
  const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showLoadingMessage, setShowLoadingMessage] = useState<boolean>(false);
  const [activeCitation, setActiveCitation] =
    useState<
      [
        content: string,
        id: string,
        title: string,
        filepath: string,
        url: string,
        metadata: string
      ]
    >();
  const [isCitationPanelOpen, setIsCitationPanelOpen] =
    useState<boolean>(false);
  const [answers, setAnswers] = useState<ChatMessage[]>([]);
  const abortFuncs = useRef([] as AbortController[]);
  const [showAuthMessage, setShowAuthMessage] = useState<boolean>(true);

  const getUserInfoList = async () => {
    const userInfoList = await getUserInfo();
    if (userInfoList.length === 0 && window.location.hostname !== "127.0.0.1") {
      setShowAuthMessage(true);
    } else {
      setShowAuthMessage(false);
    }
  };

  const makeApiRequest = async (question: string) => {
    lastQuestionRef.current = question;

    setIsLoading(true);
    setShowLoadingMessage(true);
    const abortController = new AbortController();
    abortFuncs.current.unshift(abortController);

    const userMessage: ChatMessage = {
      role: "user",
      content: question,
    };

    const request: ConversationRequest = {
      messages: [
        ...answers.filter((answer) => answer.role !== "error"),
        userMessage,
      ],
    };

    let result = {} as ChatResponse;
    try {
      const response = await conversationApi(request, abortController.signal);
      if (response?.body) {
        const reader = response.body.getReader();
        let runningText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          var text = new TextDecoder("utf-8").decode(value);
          const objects = text.split("\n");
          objects.forEach((obj) => {
            try {
              runningText += obj;
              result = JSON.parse(runningText);
              setShowLoadingMessage(false);
              setAnswers([
                ...answers,
                userMessage,
                ...result.choices[0].messages,
              ]);
              runningText = "";
            } catch {}
          });
        }
        setAnswers([...answers, userMessage, ...result.choices[0].messages]);
      }
    } catch (e) {
      if (!abortController.signal.aborted) {
        console.error(result);
        let errorMessage =
          "An error occurred. Please try again. If the problem persists, please contact the site administrator.";
        if (result.error?.message) {
          errorMessage = result.error.message;
        } else if (typeof result.error === "string") {
          errorMessage = result.error;
        }
        setAnswers([
          ...answers,
          userMessage,
          {
            role: "error",
            content: errorMessage,
          },
        ]);
      } else {
        setAnswers([...answers, userMessage]);
      }
    } finally {
      setIsLoading(false);
      setShowLoadingMessage(false);
      abortFuncs.current = abortFuncs.current.filter(
        (a) => a !== abortController
      );
    }

    return abortController.abort();
  };

  const clearChat = () => {
    lastQuestionRef.current = "";
    setActiveCitation(undefined);
    setAnswers([]);
  };

  const stopGenerating = () => {
    abortFuncs.current.forEach((a) => a.abort());
    setShowLoadingMessage(false);
    setIsLoading(false);
  };

  useEffect(() => {
    getUserInfoList();
  }, []);

  useEffect(
    () => {
      chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" });

      const observer = new MutationObserver(() => {
        chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" });
      });

      if (chatMessageStreamEnd && chatMessageStreamEnd.current) {
        observer.observe(chatMessageStreamEnd.current, {childList: true, subtree: true});
      }

      return () => {
        observer.disconnect();
      };
      [showLoadingMessage]
  }, );

  const onShowCitation = (citation: Citation) => {
    setActiveCitation([
      citation.content,
      citation.id,
      citation.title ?? "",
      citation.filepath ?? "",
      citation.url ?? "",
      "",
    ]);
    window.open(citation.url ?? "", "_blank")?.focus();
  };

  const parseCitationFromMessage = (message: ChatMessage) => {
    if (message.role === "tool") {
      try {
        const toolMessage = JSON.parse(message.content) as ToolMessageContent;
        return toolMessage.citations;
      } catch {
        return [];
      }
    }
    return [];
  };

  return (
    <div className={styles.container} role="main">
      {showAuthMessage ? (
        <Stack className={styles.chatEmptyState}>
          <ShieldLockRegular
            className={styles.chatIcon}
            style={{ color: "darkorange", height: "200px", width: "200px" }}
          />
          <h1 className={styles.chatEmptyStateTitle}>
            Authentication Not Configured
          </h1>
          <h2 className={styles.chatEmptyStateSubtitle}>
            This app does not have authentication configured. Please add an
            identity provider by finding your app in the
            <a href="https://portal.azure.com/" target="_blank">
              {" "}
              Azure Portal{" "}
            </a>
            and following
            <a
              href="https://learn.microsoft.com/en-us/azure/app-service/scenario-secure-app-authentication-app-service#3-configure-authentication-and-authorization"
              target="_blank"
            >
              {" "}
              these instructions
            </a>
            .
          </h2>
          <h2
            className={styles.chatEmptyStateSubtitle}
            style={{ fontSize: "20px" }}
          >
            <strong>
              Authentication configuration takes a few minutes to apply.{" "}
            </strong>
          </h2>
          <h2
            className={styles.chatEmptyStateSubtitle}
            style={{ fontSize: "20px" }}
          >
            <strong>
              If you deployed in the last 10 minutes, please wait and reload the
              page after 10 minutes.
            </strong>
          </h2>
        </Stack>
      ) : (
        <Stack horizontal className={styles.chatRoot}>
          <div className={styles.chatContainer} style={{maxHeight: lastQuestionRef.current ? 'calc(100vh - 200px)' : 'auto'}}>
            {!lastQuestionRef.current ? (
              <Stack className={styles.chatEmptyState}>
                <img
                  src={MyCityTitle}
                  className={styles.titleIcon}
                  aria-hidden="true"
                />
                <h2 className={styles.chatEmptyStateSubtitle}>
                  Welcome to MyCity AI Chatbot, it can provide general
                  information on a wide range of topics, offer suggestions, and
                  engage in discussions.
                </h2>
                <InfoCardList onQuestionReceived={makeApiRequest} />
              </Stack>
            ) : (
              <div
                className={styles.chatMessageStream}
                style={{ marginBottom: isLoading ? "40px" : "0px" }}
                role="log"
              >
                {answers.map((answer, index) => (
                  <>
                    {answer.role === "user" ? (
                      <div className={styles.chatMessageWrapper}>
                        <img
                          src={UserAvatar}
                          className={styles.chatUserAvatarIcon}
                          aria-hidden="true"
                        />
                        <div className={styles.chatMessageUser} tabIndex={0}>
                          <div className={styles.chatMessageUserMessage}>
                            {answer.content}
                          </div>
                        </div>
                      </div>
                    ) : answer.role === "assistant" ? (
                      <div
                        className={styles.chatMessageWrapper}>
                        <div className={styles.answerIconContainer}>
                          <img
                            src={AiAvatar}
                            className={styles.chatUserAvatarIcon}
                            aria-hidden="true"
                          />
                        </div>
                        <Answer
                          answer={{
                            answer: answer.content,
                            citations: parseCitationFromMessage(
                              answers[index - 1]
                            ),
                          }}
                          onCitationClicked={(c) => onShowCitation(c)}
                        />
                        <div />
                      </div>
                    ) : answer.role === "error" ? (
                      <div className={styles.chatMessageError}>
                        <Stack
                          horizontal
                          className={styles.chatMessageErrorContent}
                        >
                          <ErrorCircleRegular
                            className={styles.errorIcon}
                            style={{ color: "rgba(182, 52, 67, 1)" }}
                          />
                          <span>Error</span>
                        </Stack>
                        <span className={styles.chatMessageErrorContent}>
                          {answer.content}
                        </span>
                      </div>
                    ) : null}
                  </>
                ))}
                {showLoadingMessage && (
                  <div
                    className={styles.chatMessageStreamLoading}
                    style={{ marginBottom: isLoading ? "40px" : "0px" }}
                    role="log"
                  >
                    <div className={styles.chatMessageWrapper}>
                      <img
                        src={UserAvatar}
                        className={styles.chatUserAvatarIcon}
                        aria-hidden="true"
                      />
                      <div className={styles.chatMessageUser} tabIndex={0}>
                        <div className={styles.chatMessageUserMessage}>
                          {lastQuestionRef.current}
                        </div>
                      </div>
                    </div>
                    <div className={styles.chatMessageWrapper}>
                      <div className={styles.answerIconContainer}>
                          <img
                            src={AiAvatar}
                            className={styles.chatUserAvatarIcon}
                            aria-hidden="true"
                          />
                        </div>
                      <Answer
                        answer={{
                          answer: "Generating answer...",
                          citations: [],
                        }}
                        onCitationClicked={() => null}
                      />
                    </div>
                  </div>
                )}
                <div ref={chatMessageStreamEnd} />
              </div>
            )}

            <Stack horizontal className={styles.chatInput}>
              {isLoading && (
                <Stack
                  horizontal
                  className={styles.stopGeneratingContainer}
                  role="button"
                  aria-label="Stop generating"
                  tabIndex={0}
                  onClick={stopGenerating}
                  onKeyDown={(e) =>
                    e.key === "Enter" || e.key === " " ? stopGenerating() : null
                  }
                >
                  <SquareRegular
                    className={styles.stopGeneratingIcon}
                    aria-hidden="true"
                  />
                  <span
                    className={styles.stopGeneratingText}
                    aria-hidden="true"
                  >
                    Stop generating
                  </span>
                </Stack>
              )}
              {lastQuestionRef.current && !isLoading && (
                <div className={styles.newConversation} onClick={clearChat}>
                  <img
                    src={Conversation}
                    className={styles.newMessageIcon}
                    aria-hidden="true"
                  />
                  <span>New Conversation</span>
                </div>
              )}
              <QuestionInput
                clearOnSend
                placeholder="Send a message"
                disabled={isLoading}
                onSend={(question) => makeApiRequest(question)}
              />
              <div className={styles.chatDisclaimer}>
                NYC Government Preview. Knowledge is based on information
                published online until July 17 2023.
              </div>
                <div className={styles.footerContainer}>
                      <div className={styles.copyright}>
                          <span>&copy; 2023 City of New York. All Rights Reserved.</span>
                      </div>
                      <div className={styles.links}>
                          <span>Terms of Use</span>
                          <span>Privacy Policy</span>
                      </div>
                  </div>
            </Stack>
          </div>
          {answers.length > 0 && isCitationPanelOpen && activeCitation && (
            <Stack.Item
              className={styles.citationPanel}
              tabIndex={0}
              role="tabpanel"
              aria-label="Citations Panel"
            >
              <Stack
                horizontal
                className={styles.citationPanelHeaderContainer}
                horizontalAlign="space-between"
                verticalAlign="center"
              >
                <span className={styles.citationPanelHeader}>Citations</span>
                <DismissRegular
                  className={styles.citationPanelDismiss}
                  onClick={() => setIsCitationPanelOpen(false)}
                />
              </Stack>
              <h5 className={styles.citationPanelTitle} tabIndex={0}>
                {activeCitation[2]}
              </h5>
              <div tabIndex={0}>
                <ReactMarkdown
                  linkTarget="_blank"
                  className={styles.citationPanelContent}
                  children={activeCitation[0]}
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                />
              </div>
            </Stack.Item>
          )}
        </Stack>
      )}
    </div>
  );
};

export default Chat;
