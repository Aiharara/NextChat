import {ServiceProvider, STORAGE_KEY} from "@/app/constant";
import {ChatMessage, createMessage, ModalConfigValidator, ModelConfig, OptionalTemplate} from "../store";

import Locale from "../locales";
import { InputRange } from "./input-range";
import {Input, List, ListItem, Modal, PasswordInput, Select, showToast} from "./ui-lib";
import { useAllModels } from "../utils/hooks";
import { groupBy } from "lodash-es";
import styles from "./model-config.module.scss";
import { getModelProvider } from "../utils/model";
import {IconButton} from "@/app/components/button";
import ConfigIcon from "@/app/icons/config.svg";
import ResetIcon from "@/app/icons/reload.svg";
import {useState} from "react";
import {useSyncStore} from "@/app/store/sync";
import ConfirmIcon from "@/app/icons/confirm.svg";
import {ProviderType} from "@/app/utils/cloud";
import chatStyle from "@/app/components/chat.module.scss";
import AddIcon from "@/app/icons/add.svg";
import {DragDropContext, Draggable, Droppable, OnDragEndResponder} from "@hello-pangea/dnd";
import {getMessageTextContent} from "@/app/utils";
import DragIcon from "@/app/icons/drag.svg";
import {ROLES} from "@/app/client/api";
import DeleteIcon from "@/app/icons/delete.svg";

export function ModelConfigList(props: {
  modelConfig: ModelConfig;
  updateConfig: (updater: (config: ModelConfig) => void) => void;
}) {
  const allModels = useAllModels();
  const groupModels = groupBy(
    allModels.filter((v) => v.available),
    "provider.providerName",
  );
  const value = `${props.modelConfig.model}@${props.modelConfig?.providerName}`;
  const compressModelValue = `${props.modelConfig.compressModel}@${props.modelConfig?.compressProviderName}`;
  const [showOptionalTemplate, setShowOptionalTemplate] = useState(false);

  return (
    <>
      <ListItem title={Locale.Settings.Model}>
        <Select
          aria-label={Locale.Settings.Model}
          value={value}
          align="left"
          onChange={(e) => {
            const [model, providerName] = getModelProvider(
              e.currentTarget.value,
            );
            props.updateConfig((config) => {
              config.model = ModalConfigValidator.model(model);
              config.providerName = providerName as ServiceProvider;
            });
          }}
        >
          {Object.keys(groupModels).map((providerName, index) => (
            <optgroup label={providerName} key={index}>
              {groupModels[providerName].map((v, i) => (
                <option value={`${v.name}@${v.provider?.providerName}`} key={i}>
                  {v.displayName}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </ListItem>
      <ListItem
        title={Locale.Settings.Temperature.Title}
        subTitle={Locale.Settings.Temperature.SubTitle}
      >
        <InputRange
          aria={Locale.Settings.Temperature.Title}
          value={props.modelConfig.temperature?.toFixed(1)}
          min="0"
          max="1" // lets limit it to 0-1
          step="0.1"
          onChange={(e) => {
            props.updateConfig(
              (config) =>
                (config.temperature = ModalConfigValidator.temperature(
                  e.currentTarget.valueAsNumber,
                )),
            );
          }}
        ></InputRange>
      </ListItem>
      <ListItem
        title={Locale.Settings.TopP.Title}
        subTitle={Locale.Settings.TopP.SubTitle}
      >
        <InputRange
          aria={Locale.Settings.TopP.Title}
          value={(props.modelConfig.top_p ?? 1).toFixed(1)}
          min="0"
          max="1"
          step="0.1"
          onChange={(e) => {
            props.updateConfig(
              (config) =>
                (config.top_p = ModalConfigValidator.top_p(
                  e.currentTarget.valueAsNumber,
                )),
            );
          }}
        ></InputRange>
      </ListItem>
      <ListItem
        title={Locale.Settings.MaxTokens.Title}
        subTitle={Locale.Settings.MaxTokens.SubTitle}
      >
        <input
          aria-label={Locale.Settings.MaxTokens.Title}
          type="number"
          min={1024}
          max={512000}
          value={props.modelConfig.max_tokens}
          onChange={(e) =>
            props.updateConfig(
              (config) =>
                (config.max_tokens = ModalConfigValidator.max_tokens(
                  e.currentTarget.valueAsNumber,
                )),
            )
          }
        ></input>
      </ListItem>

      {props.modelConfig?.providerName == ServiceProvider.Google ? null : (
        <>
          <ListItem
            title={Locale.Settings.PresencePenalty.Title}
            subTitle={Locale.Settings.PresencePenalty.SubTitle}
          >
            <InputRange
              aria={Locale.Settings.PresencePenalty.Title}
              value={props.modelConfig.presence_penalty?.toFixed(1)}
              min="-2"
              max="2"
              step="0.1"
              onChange={(e) => {
                props.updateConfig(
                  (config) =>
                    (config.presence_penalty =
                      ModalConfigValidator.presence_penalty(
                        e.currentTarget.valueAsNumber,
                      )),
                );
              }}
            ></InputRange>
          </ListItem>

          <ListItem
            title={Locale.Settings.FrequencyPenalty.Title}
            subTitle={Locale.Settings.FrequencyPenalty.SubTitle}
          >
            <InputRange
              aria={Locale.Settings.FrequencyPenalty.Title}
              value={props.modelConfig.frequency_penalty?.toFixed(1)}
              min="-2"
              max="2"
              step="0.1"
              onChange={(e) => {
                props.updateConfig(
                  (config) =>
                    (config.frequency_penalty =
                      ModalConfigValidator.frequency_penalty(
                        e.currentTarget.valueAsNumber,
                      )),
                );
              }}
            ></InputRange>
          </ListItem>

          <ListItem
            title={Locale.Settings.InjectSystemPrompts.Title}
            subTitle={Locale.Settings.InjectSystemPrompts.SubTitle}
          >
            <input
              aria-label={Locale.Settings.InjectSystemPrompts.Title}
              type="checkbox"
              checked={props.modelConfig.enableInjectSystemPrompts}
              onChange={(e) =>
                props.updateConfig(
                  (config) =>
                    (config.enableInjectSystemPrompts =
                      e.currentTarget.checked),
                )
              }
            ></input>
          </ListItem>

          <ListItem
            title={Locale.Settings.InputTemplate.Title}
            subTitle={Locale.Settings.InputTemplate.SubTitle}
          >
            <input
              aria-label={Locale.Settings.InputTemplate.Title}
              type="text"
              value={props.modelConfig.template}
              onChange={(e) =>
                props.updateConfig(
                  (config) => (config.template = e.currentTarget.value),
                )
              }
            ></input>
          </ListItem>

          <ListItem
              title={Locale.Settings.OptionalInputTemplate.Title}
              subTitle={Locale.Settings.OptionalInputTemplate.SubTitle}
          >
            <div style={{display: "flex"}}>
              <IconButton
                  aria={Locale.Settings.Sync.CloudState + Locale.UI.Config}
                  icon={<ConfigIcon />}
                  text={Locale.UI.Config}
                  onClick={() => {
                    setShowOptionalTemplate(true);
                  }}
              />
            </div>

          </ListItem>
        </>
      )}
      <ListItem
          title={Locale.Settings.HistoryCount.Title}
          subTitle={Locale.Settings.HistoryCount.SubTitle}
      >
        <InputRange
            aria={Locale.Settings.HistoryCount.Title}
            title={props.modelConfig.historyMessageCount.toString()}
            value={props.modelConfig.historyMessageCount}
            min="0"
            max="64"
            step="1"
            onChange={(e) =>
                props.updateConfig(
                    (config) => (config.historyMessageCount = e.target.valueAsNumber),
                )
            }
        ></InputRange>
      </ListItem>

      <ListItem
          title={Locale.Settings.CompressThreshold.Title}
          subTitle={Locale.Settings.CompressThreshold.SubTitle}
      >
        <input
            aria-label={Locale.Settings.CompressThreshold.Title}
            type="number"
            min={500}
            max={4000}
            value={props.modelConfig.compressMessageLengthThreshold}
            onChange={(e) =>
            props.updateConfig(
              (config) =>
                (config.compressMessageLengthThreshold =
                  e.currentTarget.valueAsNumber),
            )
          }
        ></input>
      </ListItem>
      <ListItem title={Locale.Memory.Title} subTitle={Locale.Memory.Send}>
        <input
          aria-label={Locale.Memory.Title}
          type="checkbox"
          checked={props.modelConfig.sendMemory}
          onChange={(e) =>
            props.updateConfig(
              (config) => (config.sendMemory = e.currentTarget.checked),
            )
          }
        ></input>
      </ListItem>
      <ListItem
        title={Locale.Settings.CompressModel.Title}
        subTitle={Locale.Settings.CompressModel.SubTitle}
      >
        <Select
          className={styles["select-compress-model"]}
          aria-label={Locale.Settings.CompressModel.Title}
          value={compressModelValue}
          onChange={(e) => {
            const [model, providerName] = getModelProvider(
              e.currentTarget.value,
            );
            props.updateConfig((config) => {
              config.compressModel = ModalConfigValidator.model(model);
              config.compressProviderName = providerName as ServiceProvider;
            });
          }}
        >
          {allModels
            .filter((v) => v.available)
            .map((v, i) => (
              <option value={`${v.name}@${v.provider?.providerName}`} key={i}>
                {v.displayName}({v.provider?.providerName})
              </option>
            ))}
        </Select>
      </ListItem>

      {showOptionalTemplate && (
          <TemplateConfigModal onClose={() => setShowOptionalTemplate(false)}
          modelConfig={props.modelConfig}
          updateConfig={props.updateConfig}/>
      )}
    </>
  );
}


function TemplateConfigModal(props: {
  onClose?: () => void;
  modelConfig: ModelConfig;
  updateConfig: (updater: (config: ModelConfig) => void) => void;
}) {

  function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
    const result = [...list];
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
  }

  const onDragEnd: OnDragEndResponder = (result) => {
    if (!result.destination) {
      return;
    }
    const newConfig = reorder(
        props.modelConfig.optionalTemplate,
        result.source.index,
        result.destination.index,
    );
    props.updateConfig(
        (config) => (config.optionalTemplate = newConfig),
    );
  };

  function addNewTemplate(index?: number) {
    const defaultTemplate = {name: Locale.Settings.OptionalInputTemplate.Config.NamePlaceholder, template: '{{ input }}'};
    if (index === undefined) {
      props.updateConfig(
          (config) => {
            config.optionalTemplate = config.optionalTemplate || [];
            config.optionalTemplate.push(defaultTemplate);
          }
      );
    } else {
      props.updateConfig(
          (config) => {
            config.optionalTemplate = config.optionalTemplate || [];
            config.optionalTemplate.splice(index, 0, defaultTemplate);
          }
      );
    }
  }

  function updateTemplate(index: number, template: OptionalTemplate) {
    props.updateConfig((config) => {
      config.optionalTemplate = config.optionalTemplate || [];
      config.optionalTemplate[index] = template;
    });
  }

  function removeTemplate(index: number) {
    props.updateConfig((config) => {
      config.optionalTemplate = config.optionalTemplate || [];
      config.optionalTemplate.splice(index, 1);
    });
  }

  return (
      <div className="modal-mask">
        <Modal
            title={Locale.Settings.OptionalInputTemplate.Config.Title}
            onClose={() => props.onClose?.()}
            actions={[
              <IconButton
                  key="confirm"
                  onClick={props.onClose}
                  icon={<ConfirmIcon/>}
                  bordered
                  text={Locale.UI.Confirm}
              />,
            ]}
        >

          <div className={chatStyle["context-prompt"]} style={{marginBottom: 20}}>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="context-prompt-list">
                {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                      {(props.modelConfig.optionalTemplate || []).map((c, i) => (
                          <Draggable
                              draggableId={i.toString()}
                              index={i}
                              key={i}
                          >
                            {(provided) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                >
                                  <OptionalTemplateItem
                                      index={i}
                                      template={c}
                                      update={(prompt) => updateTemplate(i, prompt)}
                                      remove={() => removeTemplate(i)}
                                  />
                                  <div
                                      className={chatStyle["context-prompt-insert"]}
                                      onClick={() => addNewTemplate(i+1)}
                                  >
                                    <AddIcon/>
                                  </div>
                                </div>
                            )}
                          </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>


            <div className={chatStyle["context-prompt-row"]}>
              <IconButton
                  icon={<AddIcon/>}
                  text={Locale.Settings.OptionalInputTemplate.Config.Add}
                  bordered
                  className={chatStyle["context-prompt-button"]}
                  onClick={() => addNewTemplate()}
              />
            </div>

        </Modal>
      </div>
);
}

function OptionalTemplateItem(props: {
  index: number;
  template: OptionalTemplate;
  update: (template: OptionalTemplate) => void;
  remove: () => void;
}) {
  const [focusingNameInput, setFocusingNameInput] = useState(false);
  const [focusingTemplateInput, setFocusingTemplateInput] = useState(false);

  return (
      <div className={chatStyle["context-prompt-row"]}>
        {!focusingNameInput && !focusingTemplateInput && (
            <>
              <div className={chatStyle["context-drag"]}>
                <DragIcon />
              </div>
            </>
        )}
        <Input
            value={props.template.name}
            type="text"
            className={chatStyle["context-content"]}
            rows={focusingNameInput ? 5 : 1}
            onFocus={() => setFocusingNameInput(true)}
            onBlur={() => {
              setFocusingNameInput(false);
              // If the selection is not removed when the user loses focus, some
              // extensions like "Translate" will always display a floating bar
              window?.getSelection()?.removeAllRanges();
            }}
            onInput={(e) =>
                props.update({
                  ...props.template,
                  name: e.currentTarget.value as any,
                })
            }
        />
        <Input
            value={props.template.template}
            type="text"
            className={chatStyle["context-content-big"]}
            rows={focusingTemplateInput ? 5 : 1}
            onFocus={() => setFocusingTemplateInput(true)}
            onBlur={() => {
              setFocusingTemplateInput(false);
              // If the selection is not removed when the user loses focus, some
              // extensions like "Translate" will always display a floating bar
              window?.getSelection()?.removeAllRanges();
            }}
            onInput={(e) =>
                props.update({
                  ...props.template,
                  template: e.currentTarget.value as any,
                })
            }
        />
        {!focusingTemplateInput && (
            <IconButton
                icon={<DeleteIcon />}
                className={chatStyle["context-delete-button"]}
                onClick={() => props.remove()}
                bordered
            />
        )}
      </div>
  );
}