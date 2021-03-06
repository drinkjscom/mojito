/* eslint-disable no-undef */
/* eslint-disable no-param-reassign */
/**
 * 图层类，负责生成组件，控制组件的大小位置，请求数据
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo
} from 'react';
import { useHistory } from 'react-router-dom';
import { observer, inject } from 'mobx-react';
import anime from 'animejs';
import { merge } from "lodash";
import eventer from 'common/eventer';
import { request } from 'common/network';
import { sendDataToPage, useSync } from 'common/stateTool';
import {
  ComponentStyleQuery,
  LayerEvents,
  LayerInfo,
  ScreenStore
} from 'types';
import { buildCode, isEmpty } from 'common/util';
import { loadLib, LoadingComponent } from '../../../../components/Loader';
import Render from './Render';
import styles from './index.module.scss';
import { DefaultLayerSize } from 'config';
import Message from 'components/Message';
import { toJS } from 'mobx';
import { useUpdateEffect } from 'ahooks';

const md5 = require('blueimp-md5');
const numeral = require('numeral');

function showHandlerError (layerName: string, error: any) {
  Message.error(`${layerName}事件处理错误:${error.message}`);
  console.error(`${layerName}事件处理错误:${error.message}`);
}
/**
 * 解释数源中的参数
 * @param params
 */
export function parseParams (params: string) {
  if (!params) return {};
  // 替换${xxx}变量，变量会对应映射global的值 {"a":"${myname}"}会替换会{"a":global["myname"]}
  const globalObj: any = global;
  try {
    const regx = /"\${[\d\w_]+}"/g;
    const newParams = params.replace(regx, (match: string) => {
      const val = match.substring(3, match.length - 2);
      if (
        typeof globalObj[val] === 'object' ||
        typeof globalObj[val] === 'string'
      ) {
        return JSON.stringify(globalObj[val]);
      }
      return globalObj[val] === undefined ? null : globalObj[val];
    });
    return JSON.parse(newParams);
  } catch (e) {
    Message.error('参数解释错误');
    return {};
  }
}

/**
 * 事件里的网络请求
 */
export function eventRequest (
  originUrl: string,
  method: string,
  params?: any,
  options?: any
) {
  return request(originUrl, method, params || {}, {
    prefix: '/',
    checkCode: false,
    ...options
  });
}

export const LayerEvent: { [key: string]: string } = {
  onLoad: '__onLayerLoad__',
  onDataSource: '__onLayerData__',
  onShow: '__onLayerShow__',
  onUnload: '__onLayerUnload__',
  onSync: '__onSync__'
};

interface LayerProps extends React.HTMLAttributes<Element> {
  data: LayerInfo;
  defaultWidth: number;
  defaultHeight: number;
  enable?: boolean;
  hide?: boolean;
  onSelected?: (
    data: LayerInfo,
    e?: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => void;
  onReady?: (data: LayerInfo) => void;
  screenStore?: ScreenStore;
}

interface EventValue {
  styles?: ComponentStyleQuery;
  props?: { [key: string]: any };
}

interface EventSync {
  event: string;
  args: any;
  syncPage: boolean;
}

const Layer = inject('screenStore')(
  observer(
    ({
      screenStore,
      data,
      enable = false,
      onSelected,
      onReady,
      defaultWidth,
      defaultHeight,
      ...restProps
    }: LayerProps) => {
      const targetRef = useRef<HTMLDivElement | null | undefined>();
      const currAnime = useRef<anime.AnimeInstance | undefined | null>();
      const funThis = useRef<any>(); // 事件处理的this

      const initSizeFlag = useRef<boolean>(data.initSize);
      const dataSourceTimer = useRef<any>();
      const initFlag = useRef<boolean>(false);

      // 组件的事件处理方法
      const [compEventHandlers, setCompEventHandlers] = useState<any>({}); // 组件事件
      const [allEventHandlers, setAllEventHandlers] = useState<any>({}); // 所有事件
      // 事件设置的props和styles
      const [eventRel, setEventRel] = useState<EventValue>({});
      // 数据源
      const [dataSource, setDataSource] = useState<any>();
      // 加载组件
      const [lib, setLib] = useState<any>();
      const [libLoading, setLibLoading] = useState(false);
      const [hide, setHide] = useState(false);
      const [dataloading, setDataloading] = useState(false);
      // 事件同步处理
      const [eventySync, setEventSync] = enable
        ? []
        : useSync<EventSync>(
          { event: '', args: [], syncPage: false },
          md5(
              `${screenStore!.screenInfo!.project.name}_${
                screenStore!.screenInfo!.name
              }_${data.name}`
          )
        ); // 项目名称_大屏名称_图层名称组成唯一的同步key

      const history = useHistory();

      // 组件默认数据
      const defaultProps: any = {};
      const { component } = data;
      if (component && component.props) {
        Object.keys(component.props).forEach((key) => {
          defaultProps[key] = component.props
            ? component.props[key].default
            : undefined;
        });
      }

      useEffect(() => {
        // 事件处理
        const allEvnet: any = parseEvents(data.events);

        // 加载三方组件
        if (component && component.origin === 2) {
          setLibLoading(true);
          loadLib(component, (comp: any) => {
            setLib(comp);
            setLibLoading(false);
          });
        }

        // 组件加载完成事件回调
        if (allEvnet[LayerEvent.onLoad]) {
          runEventHandler(allEvnet[LayerEvent.onLoad]);
        }

        // 请求数据源
        if (data.api && data.api.url) {
          const { url, method, params, interval } = data.api;
          const formatParams = parseParams(JSON.stringify(params));
          requestDataSource(
            url,
            method,
            formatParams,
            allEvnet[LayerEvent.onDataSource]
          );
          if (interval && interval > 0) {
            // 轮询
            clearInterval(dataSourceTimer.current);
            dataSourceTimer.current = setInterval(
              requestDataSource,
              interval,
              url,
              method,
              formatParams,
              allEvnet[LayerEvent.onDataSource]
            );
          }
        }

        return () => {
          clearInterval(dataSourceTimer.current);
          // 组件卸载事件回调
          if (allEvnet[LayerEvent.onUnload]) {
            runEventHandler(allEvnet[LayerEvent.onUnload]);
          }

          if (currAnime.current) {
            currAnime.current.pause();
            currAnime.current = null;
            targetRef.current && anime.remove(targetRef.current);
          }
        };
      }, []);

      useEffect(() => {
        if (data) {
          setHide(!!data.hide);
        }
      }, [data]);

      /**
       * 接收事件同步
       */
      useUpdateEffect(() => {
        if (
          eventySync &&
          eventySync.event &&
          allEventHandlers[eventySync.event]
        ) {
          // 调用组件事件处理器
          componentEventsHandler(
            allEventHandlers[eventySync.event],
            ...eventySync.args
          );
        } else if (
          allEventHandlers[LayerEvent.onSync] &&
          eventySync &&
          eventySync.syncPage
        ) {
          // 跨屏数据同步
          runEventHandler(
            allEventHandlers[LayerEvent.onSync],
            ...eventySync.args
          );
        }
      }, [eventySync, allEventHandlers]);

      /**
       * 解释组件事件
       */
      const parseEvents = useCallback((events: LayerEvents | undefined) => {
        // 事件处理
        const allEvnet: any = {};
        const compEvent: any = {};
        // const { events } = data;
        if (events) {
          Object.keys(events).forEach((key) => {
            let callFun: Function | null = null;
            try {
              callFun = events[key].code ? buildCode(events[key].code) : null;
            } catch (e) {
              showHandlerError(data.name, e);
            }

            if (!callFun || typeof callFun !== 'function') return;

            allEvnet[key] = callFun;
            const eventValues = Object.keys(LayerEvent).map(
              (key) => LayerEvent[key]
            );
            if (eventValues.indexOf(key) !== -1) {
              // 系统事件
              //  allEvnet[key] = callFun;
            } else {
              compEvent[key] = (...args: any[]) => {
                // 同步事件 编辑状态下不做同步
                if (events[key].isSync && setEventSync) {
                  setEventSync({ event: key, args });
                  return;
                }
                // 调用组件的事件处理
                callFun && componentEventsHandler(callFun, ...args);
              };
            }
          });
          setCompEventHandlers(compEvent);
          setAllEventHandlers(allEvnet);
        }
        return allEvnet;
      }, []);

      /**
       * 请求数据源
       */
      const requestDataSource = (
        api: string,
        method: string,
        params?: any,
        onLayerData?: Function
      ) => {
        const newParams = params || {};
        setDataloading(true);
        eventRequest(api, method, newParams).then((res) => {
          setDataSource(res);
          // 数据加载完成事件处理
          if (onLayerData) {
            runEventHandler(onLayerData, res);
          }
        }).finally(() => {
          setDataloading(false)
        })
      };

      /**
       * 执行事件处理方法
       * @param callback
       * @param args
       */
      const runEventHandler = (callback: Function, ...args: any[]) => {
        try {
          callback.call(createThis(), ...args);
        } catch (e) {
          showHandlerError(data.name, e);
        }
      };

      /**
       * 组件事件处理
       * @param callback
       */
      const componentEventsHandler = useCallback(
        async (callback: Function, ...args: any[]) => {
          try {
            const self = createThis();
            callback.call(self, ...args);
          } catch (e) {
            showHandlerError(data.name, e);
          }
        },
        [eventRel, data]
      );

      /**
       * 事件处理设置props
       */
      const setProps = useCallback(
        (props: any) => {
          eventRel.props = {
            ...eventRel.props,
            ...props
          };
          setEventRel({ ...eventRel });
        },
        [eventRel]
      );

      /**
       * 事件处理设置style
       */
      const setStyles = useCallback(
        (styles: any) => {
          eventRel.styles = {
            ...eventRel.styles,
            ...styles
          };
          setEventRel({ ...eventRel });
        },
        [eventRel]
      );

      /**
       * 创建事件处理方法this
       */
      const createThis = () => {
        const currArgs = mergeArgs();
        if (funThis.current) {
          funThis.current.props = currArgs.props;
          funThis.current.styles = currArgs.styles;
        } else {
          funThis.current = {
            ...currArgs,
            currAnime: enable ? anime({}) : currAnime.current,
            eventer,
            request: eventRequest,
            numeral,
            merge,
            setProps,
            setStyles,
            setHide,
            // router: history,
            goto: (screenName: string) => {
              history.push(
                `/view/${screenStore?.screenInfo?.project.name.replace(
                  '%',
                  '%25'
                )}/${screenName.replace('%', '%25')}`
              );
            },
            goBack: () => {
              history.goBack();
            },
            sync: (params: { screen: string; layer?: string; data: any }) => {
              sendDataToPage(
                `/view/${screenStore?.screenInfo?.project.name}/${params.screen}`,
                { args: [params.data] },
                params.layer
                  ? md5(
                      `${screenStore!.screenInfo!.project.name}_${
                        params.screen
                      }_${params.layer}`
                  )
                  : ''
              );
            },
            anime: (animeParams: anime.AnimeParams) => {
              return anime({
                ...animeParams,
                targets: targetRef.current
              });
            },
            layer: targetRef.current,
            layerId: data.id
          };
        }
        return funThis.current;
      };

      /**
       * 合并props和style后的值
       */
      const mergeArgs = () => {
        const mergeProps = toJS({
          ...defaultProps,
          ...data.props, // 组件属性配置
          ...dataSource, // 数据源返回
          ...eventRel.props // 事件处理返回
        });

        const mergeStyle = toJS({
          ...data.style, // 样式设置
          ...eventRel.styles // 事件返回改变样式
        });

        return { props: mergeProps, styles: mergeStyle };
      };

      /**
       * 选中组件
       */
      const onClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
          e.stopPropagation();
          targetRef.current?.focus()
          if (onSelected) {
            onSelected(data, e);
          }
        },
        [data]
      );

      /**
       * 组件初始化大小
       */
      const onInitSize = useCallback(
        (width: number, height: number) => {
          if (onReady) {
            onReady(data);
          }

          if (initSizeFlag.current || data.initSize || !enable) {
            initSizeFlag.current = true;
            return;
          }

          initSizeFlag.current = true;
          // 获取组件大小并更新，组件没有固定大小时默认300x200
          const setWidth = width && height ? width : defaultWidth;
          const setHeight = width && height ? height : defaultHeight;
          if (data && data.style && data.style.x && data.style.y && data.id) {
            const left =
              data.style.x + DefaultLayerSize.width / 2 - setWidth / 2;
            const top =
              data.style.y + DefaultLayerSize.height / 2 - setHeight / 2;

            targetRef.current!.style.width = `${setWidth}px`;
            targetRef.current!.style.height = `${setHeight}px`;
            targetRef.current!.style.transform = `translateX(${data.style.x}px) translateY(${data.style.y}px)`;

            data.style.x = left;
            data.style.y = top;
            data.style.width = setWidth;
            data.style.height = setHeight;

            // 更新图层
            screenStore!.updateLayer(data.id, {
              style: { ...data.style },
              initSize: true
            });
          }
        },
        [data, allEventHandlers]
      );

      const onShow = () => {
        if (!enable && data.anime) {
          // 非编辑状态执行动画
          if (
            isEmpty(data.anime.translateX) &&
            isEmpty(data.anime.translateY) &&
            isEmpty(data.anime.scale) &&
            isEmpty(data.anime.rotate) &&
            isEmpty(data.anime.opacity)
            // isEmpty(data.anime.width) &&
            // isEmpty(data.anime.height)
          ) {
            return;
          }
          const keys = Object.keys(data.anime);
          // 动画参数
          const params: any = {};
          const animeParams: any = data.anime;
          keys.forEach((key) => {
            if (!isEmpty(animeParams[key])) {
              params[key] = animeParams[key];
            }
          });
          // 重复次数，0为无限
          if (!isEmpty(params.loop) && params.loop === 0) {
            params.loop = true;
          }

          if (isEmpty(params.autoplay)) {
            params.auto = true;
          }

          currAnime.current = anime({
            ...params,
            targets: targetRef.current
          });
        }

        // 组件完全显示
        if (allEventHandlers[LayerEvent.onShow]) {
          runEventHandler(allEventHandlers[LayerEvent.onShow]);
        }
      };

      /**
       * 事件变化时绑定事件
       */
      useMemo(() => {
        initFlag.current && parseEvents(data.events);
      }, [JSON.stringify(data.events)]);

      const mergeParms = mergeArgs();

      // const formatStyles = parseStyle(data.style);

      const scale =
        data.style.scale !== undefined ? `scale(${data.style.scale})` : '';
      const rotate =
        data.style.rotate !== undefined ? `rotate(${data.style.rotate})` : '';

      return (
        <div
          {...restProps}
          className={styles.layer}
          ref={(ref) => {
            targetRef.current = ref;
          }}
          style={{
            ...data.style,
            transform: `translateX(${data.style.x}px) translateY(${data.style.y}px) ${scale} ${rotate}`,
            zIndex: data.style.z,
            display: !enable && (hide || data.groupHide) ? 'none' : 'block',
            opacity:
              enable && (data.groupHide || hide) ? 0.2 : data.style.opacity,
            overflow:
              screenStore!.resizeing &&
              screenStore!.currLayer &&
              screenStore!.currLayer.id === data.id
                ? 'hidden'
                : data.style.overflow || 'visible'
          }}
          onMouseDown={onClick}
          id={data.id}
          tabIndex={enable ? 0 : undefined}
        >
          {!libLoading && lib && (
            <Render
              onInitSize={onInitSize}
              onShow={onShow}
              developLib={data.component.developLib}
              component={lib.default}
              props={{ ...mergeParms.props, dataloading }}
              styles={{
                ...mergeParms.styles,
                background: undefined,
                opacity: undefined,
                transform: undefined,
                overflow: undefined,
                borderStyle: undefined,
                borderWidth: undefined,
                borderColor: undefined,
                borderRadius: undefined
              }}
              events={compEventHandlers}
              style={{
                display: 'flex',
                width: '100%',
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                pointerEvents: enable && data.eventLock ? 'none' : undefined
              }}
              componentName={data.component.name}
            />
          )}
          {libLoading && <LoadingComponent />}
        </div>
      );
    }
  )
);

export default React.memo(
  Layer,
  (prevProps: LayerProps, nextProps: LayerProps) => {
    return prevProps.data.updateFlag === nextProps.data.updateFlag;
  }
);
