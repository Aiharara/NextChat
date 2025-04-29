import {ApiPath, GEMINI_BASE_URL, Google} from "@/app/constant";
import {ChatOptions, getHeaders, LLMApi, LLMModel, LLMUsage, MultimodalContent, SpeechOptions,} from "../api";
import {ChatMessageTool, useAccessStore, useAppConfig, useChatStore, usePluginStore,} from "@/app/store";
import {preProcessImageContent, stream, streamWithThink} from "@/app/utils/chat";
import {getClientConfig} from "@/app/config/client";

import {getMessageImages, getMessageTextContent, getTimeoutMSByModel, isVisionModel,} from "@/app/utils";
import {nanoid} from "nanoid";
import {RequestPayload} from "./openai";
import {fetch} from "@/app/utils/stream";
import {getServerSideConfig} from "@/app/config/server";

const serverConfig = getServerSideConfig();

export class GeminiProApi implements LLMApi {
  path(path: string): string {
    const accessStore = useAccessStore.getState();

    let baseUrl = "";
    if (accessStore.useCustomConfig) {
      baseUrl = accessStore.googleUrl;
    }
    console.log("[baseURL]", baseUrl);
    const isApp = !!getClientConfig()?.isApp;
    if (baseUrl.length === 0) {
      baseUrl = isApp ? GEMINI_BASE_URL : "https://api.claude-plus.top";
    }
    console.log("[baseURL]", baseUrl);


    if (baseUrl.endsWith("/")) {
      baseUrl = baseUrl.slice(0, baseUrl.length - 1);
    }
    if (!baseUrl.startsWith("http") && !baseUrl.startsWith(ApiPath.Google)) {
      baseUrl = "https://" + baseUrl;
    }

    console.log("[Proxy Endpoint] ", baseUrl, path);

    return [baseUrl, path].join("/");
  }
  extractMessage(res: any) {
    console.log("[Response] gemini-pro response: ", res);

    const getTextFromParts = (parts: any[]) => {
      if (!Array.isArray(parts)) return "";

      return parts
        .map((part) => part?.text || "")
        .filter((text) => text.trim() !== "")
        .join("\n\n");
    };

    let content = "";
    if (Array.isArray(res)) {
      res.map((item) => {
        content += getTextFromParts(item?.candidates?.at(0)?.content?.parts);
      });
    }

    return (
      getTextFromParts(res?.candidates?.at(0)?.content?.parts) ||
      content || //getTextFromParts(res?.at(0)?.candidates?.at(0)?.content?.parts) ||
      res?.error?.message ||
      ""
    );
  }
  speech(options: SpeechOptions): Promise<ArrayBuffer> {
    throw new Error("Method not implemented.");
  }

  async chat(options: ChatOptions): Promise<void> {
    const apiClient = this;
    let multimodal = false;

    // try get base64image from local cache image_url
    const _messages: ChatOptions["messages"] = [];
    for (const v of options.messages) {
      const content = await preProcessImageContent(v.content);
      _messages.push({ role: v.role, content });
    }
    // const messages = _messages.map((v) => {
    //   let parts: any[] = [{ text: getMessageTextContent(v) }];
    //   if (isVisionModel(options.config.model)) {
    //     const images = getMessageImages(v);
    //     if (images.length > 0) {
    //       multimodal = true;
    //       parts = parts.concat(
    //         images.map((image) => {
    //           const imageType = image.split(";")[0].split(":")[1];
    //           const imageData = image.split(",")[1];
    //           return {
    //             inline_data: {
    //               mime_type: imageType,
    //               data: imageData,
    //             },
    //           };
    //         }),
    //       );
    //     }
    //   }
    //   return {
    //     role: v.role.replace("assistant", "model").replace("system", "user"),
    //     parts: parts,
    //   };
    // });

    const messages: ChatOptions["messages"] = [];
    for (const v of options.messages) {
      const content = getMessageTextContent(v);
      if (!(v.role === "system"))
        messages.push({ role: v.role, content });
    }

    // google requires that role in neighboring messages must not be the same
    for (let i = 0; i < messages.length - 1; ) {
      // Check if current and next item both have the role "model"
      if (messages[i].role === messages[i + 1].role) {
        // Concatenate the 'parts' of the current and next item
        const content = messages[i].content;
        if (typeof content === "string" && typeof messages[i + 1].content === "string") {
          messages[i].content = content + "\n\n" + messages[i + 1].content;
        } else if (Array.isArray(content) && Array.isArray(messages[i + 1].content)) {
          messages[i].content = (messages[i].content as MultimodalContent[]).concat(messages[i + 1].content as MultimodalContent[]);
        }

        // Remove the next item
        messages.splice(i + 1, 1);
      } else {
        // Move to the next item
        i++;
      }
    }
    // if (visionModel && messages.length > 1) {
    //   options.onError?.(new Error("Multiturn chat is not enabled for models/gemini-pro-vision"));
    // }

    const accessStore = useAccessStore.getState();

    let shouldStream = !!options.config.stream;

    const modelConfig = {
      ...useAppConfig.getState().modelConfig,
      ...useChatStore.getState().currentSession().mask.modelConfig,
      ...{
        model: options.config.model,
      },
    };
    // const requestPayload = {
    //   contents: messages,
    //   generationConfig: {
    //     // stopSequences: [
    //     //   "Title"
    //     // ],
    //     temperature: modelConfig.temperature,
    //     maxOutputTokens: modelConfig.max_tokens,
    //     topP: modelConfig.top_p,
    //     // "topK": modelConfig.top_k,
    //   },
    //   safetySettings: [
    //     {
    //       category: "HARM_CATEGORY_HARASSMENT",
    //       threshold: accessStore.googleSafetySettings,
    //     },
    //     {
    //       category: "HARM_CATEGORY_HATE_SPEECH",
    //       threshold: accessStore.googleSafetySettings,
    //     },
    //     {
    //       category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    //       threshold: accessStore.googleSafetySettings,
    //     },
    //     {
    //       category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    //       threshold: accessStore.googleSafetySettings,
    //     },
    //   ],
    // };

    const requestPayload = {
      model: modelConfig.model,
      messages: messages,
      temperature: modelConfig.temperature,
      top_p: modelConfig.top_p,
      max_tokens: modelConfig.max_tokens,
      stream: shouldStream,
    };


    const controller = new AbortController();
    options.onController?.(controller);
    try {
      // https://github.com/google-gemini/cookbook/blob/main/quickstarts/rest/Streaming_REST.ipynb
      const chatPath = this.path(Google.ChatPath);

      const chatPayload = {
        method: "POST",
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
        headers: getHeaders(),
      };

      const isThinking = options.config.model.includes("-thinking");
      // make a fetch request
      const requestTimeoutId = setTimeout(
        () => controller.abort(),
        getTimeoutMSByModel(options.config.model),
      );

      if (shouldStream) {
        let index = -1;
        const [tools, funcs] = usePluginStore
          .getState()
          .getAsTools(
            useChatStore.getState().currentSession().mask?.plugin || [],
          );

        streamWithThink(
            chatPath,
            requestPayload,
            getHeaders(),
            tools as any,
            funcs,
            controller,
            // parseSSE
            (text: string, runTools: ChatMessageTool[]) => {
              // console.log("parseSSE", text, runTools);
              const json = JSON.parse(text);
              const choices = json.choices as Array<{
                delta: {
                  content: string;
                  tool_calls: ChatMessageTool[];
                  reasoning_content: string | null;
                };
              }>;

              if (!choices?.length) return { isThinking: false, content: "" };

              const tool_calls = choices[0]?.delta?.tool_calls;
              if (tool_calls?.length > 0) {
                const id = tool_calls[0]?.id;
                const args = tool_calls[0]?.function?.arguments;
                if (id) {
                  index += 1;
                  runTools.push({
                    id,
                    type: tool_calls[0]?.type,
                    function: {
                      name: tool_calls[0]?.function?.name as string,
                      arguments: args,
                    },
                  });
                } else {
                  // @ts-ignore
                  runTools[index]["function"]["arguments"] += args;
                }
              }

              const reasoning = choices[0]?.delta?.reasoning_content;
              const content = choices[0]?.delta?.content;

              // Skip if both content and reasoning_content are empty or null
              if (
                  (!reasoning || reasoning.length === 0) &&
                  (!content || content.length === 0)
              ) {
                return {
                  isThinking: false,
                  content: "",
                };
              }

              if (reasoning && reasoning.length > 0) {
                return {
                  isThinking: true,
                  content: reasoning,
                };
              } else if (content && content.length > 0) {
                return {
                  isThinking: false,
                  content: content,
                };
              }

              return {
                isThinking: false,
                content: "",
              };
            },
            // processToolMessage, include tool_calls message and tool call results
            (
                requestPayload: RequestPayload,
                toolCallMessage: any,
                toolCallResult: any[],
            ) => {
              // reset index value
              index = -1;
              // @ts-ignore
              requestPayload?.messages?.splice(
                  // @ts-ignore
                  requestPayload?.messages?.length,
                  0,
                  toolCallMessage,
                  ...toolCallResult,
              );
            },
            options,
        );
        // return stream(
        //   chatPath,
        //   requestPayload,
        //   getHeaders(),
        //   // @ts-ignore
        //   tools.length > 0
        //     ? // @ts-ignore
        //       [{ functionDeclarations: tools.map((tool) => tool.function) }]
        //     : [],
        //   funcs,
        //   controller,
        //   // parseSSE
        //   (text: string, runTools: ChatMessageTool[]) => {
        //     // console.log("parseSSE", text, runTools);
        //     const chunkJson = JSON.parse(text);
        //
        //     const functionCall = chunkJson?.candidates
        //       ?.at(0)
        //       ?.content.parts.at(0)?.functionCall;
        //     if (functionCall) {
        //       const { name, args } = functionCall;
        //       runTools.push({
        //         id: nanoid(),
        //         type: "function",
        //         function: {
        //           name,
        //           arguments: JSON.stringify(args), // utils.chat call function, using JSON.parse
        //         },
        //       });
        //     }
        //     return chunkJson?.candidates
        //       ?.at(0)
        //       ?.content.parts?.map((part: { text: string }) => part.text)
        //       .join("\n\n");
        //   },
        //   // processToolMessage, include tool_calls message and tool call results
        //   (
        //     requestPayload: RequestPayload,
        //     toolCallMessage: any,
        //     toolCallResult: any[],
        //   ) => {
        //     // @ts-ignore
        //     requestPayload?.contents?.splice(
        //       // @ts-ignore
        //       requestPayload?.contents?.length,
        //       0,
        //       {
        //         role: "model",
        //         parts: toolCallMessage.tool_calls.map(
        //           (tool: ChatMessageTool) => ({
        //             functionCall: {
        //               name: tool?.function?.name,
        //               args: JSON.parse(tool?.function?.arguments as string),
        //             },
        //           }),
        //         ),
        //       },
        //       // @ts-ignore
        //       ...toolCallResult.map((result) => ({
        //         role: "function",
        //         parts: [
        //           {
        //             functionResponse: {
        //               name: result.name,
        //               response: {
        //                 name: result.name,
        //                 content: result.content, // TODO just text content...
        //               },
        //             },
        //           },
        //         ],
        //       })),
        //     );
        //   },
        //   options,
        // );
      } else {
        const res = await fetch(chatPath, chatPayload);
        clearTimeout(requestTimeoutId);
        const resJson = await res.json();
        if (resJson?.promptFeedback?.blockReason) {
          // being blocked
          options.onError?.(
            new Error(
              "Message is being blocked for reason: " +
                resJson.promptFeedback.blockReason,
            ),
          );
        }
        const message = apiClient.extractMessage(resJson);
        options.onFinish(message, res);
      }
    } catch (e) {
      console.log("[Request] failed to make a chat request", e);
      options.onError?.(e as Error);
    }
  }
  usage(): Promise<LLMUsage> {
    throw new Error("Method not implemented.");
  }
  async models(): Promise<LLMModel[]> {
    return [];
  }
}
