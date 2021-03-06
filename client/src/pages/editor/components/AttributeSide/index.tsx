/* eslint-disable react/display-name */
import React, { useState, useEffect, Suspense } from 'react';
import { observer, inject } from 'mobx-react';
import { Tooltip, Input } from 'antd';
import IconFont from 'components/IconFont';
import { Resizable } from 're-resizable';
import { LoadingComponent, lazyLoader } from 'components/Loader';
import { ScreenStore } from 'types';
import styles from './index.module.scss';
import Style from './Style';
import Anime from './Anime';
// import PropsSet from './Props';
// import Events from "./Events";
import PageSet from './PageSet';
import Layers from './Layers';
import GroupSet from './GroupSet';

const classNames = require('classnames');

const Events = lazyLoader(() => import('./Events'));
const PropsSet = lazyLoader(() => import('./Props'));

type TabObj = {
  label: string;
  key: string;
  icon: string;
  render: (key?: string) => any;
};

const tabs: TabObj[] = [
  {
    label: '页面设置',
    key: 'pageSet',
    icon: 'icon-weixuanzhong',
    render: () => <PageSet />
  },
  {
    label: '图层',
    key: 'layers',
    icon: 'icon-tuceng',
    render: () => <Layers />
  },
  {
    label: '图层样式',
    key: 'style',
    icon: 'icon-css',
    render: (key?: string) => <Style key={key} />
  },
  {
    label: '组件属性',
    key: 'props',
    icon: 'icon-shuxing1',
    render: (key?: string) => (
      <Suspense fallback={<LoadingComponent skeleton />}>
        <PropsSet key={key} />
      </Suspense>
    )
  },
  {
    label: '交互事件',
    key: 'events',
    icon: 'icon-dianjishijian',
    render: (key?: string) => (
      <Suspense fallback={<LoadingComponent skeleton />}>
        <Events key={key} />
      </Suspense>
    )
  },
  {
    label: '动画效果',
    key: 'anime',
    icon: 'icon-donghua',
    render: (key?: string) => <Anime key={key} />
  },
  {
    label: '群组设置',
    key: 'group',
    icon: 'icon-changyongtubiao_xiangmuzushezhi',
    render: () => <GroupSet />
  }
];

const compTabKeys = ['style', 'props', 'events', 'anime'];

interface Props {
  screenStore?: ScreenStore;
}

export default inject('screenStore')(
  observer((props: Props) => {
    const { screenStore } = props;
    const [selectedTab, setSelectedTab] = useState<TabObj>();
    const [editLayerNameFlag, setEditLayerNameFlag] = useState(false);

    useEffect(() => {
      if (
        !screenStore!.currLayer &&
        selectedTab &&
        compTabKeys.indexOf(selectedTab.key) >= 0
      ) {
        setSelectedTab(tabs[0]);
      }

      if (
        screenStore!.selectedLayerIds.size < 2 &&
        selectedTab &&
        selectedTab.key === 'group'
      ) {
        setSelectedTab(tabs[0]);
      }

      setEditLayerNameFlag(false);
    }, [screenStore!.currLayer, screenStore!.selectedLayerIds]);

    /**
     * 修改图层名称
     * @param e
     */
    const onUpdateLayerName = (e: any) => {
      setEditLayerNameFlag(false);
      if (
        !e.target.value ||
        !screenStore ||
        !screenStore.currLayer ||
        !screenStore.currLayer.id
      ) {
        return;
      }
      screenStore.updateLayer(screenStore.currLayer.id, {
        name: e.target.value
      });
    };

    /**
     * 切换属性面板
     * @param tab
     */
    const onTab = (tab: TabObj) => {
      return (e: any) => {
        e.stopPropagation();
        if (tab === selectedTab) setSelectedTab(undefined);
        else setSelectedTab(tab);
      };
    };

    const renderTab = () => {
      if (!screenStore?.screenInfo) return;
      return (
        <div className={styles.tabBox}>
          {tabs.map((v) => {
            if (!screenStore!.currLayer && compTabKeys.indexOf(v.key) >= 0) {
              return null;
            }
            if (screenStore!.layerGroup.length < 2 && v.key === 'group') {
              return null;
            }
            return (
              <Tooltip key={v.key} title={v.label} placement="left">
                <div
                  className={classNames(styles.tab, {
                    [styles.tabSelected]:
                      selectedTab && v.key === selectedTab.key
                  })}
                  onClick={onTab(v)}
                >
                  <IconFont type={v.icon} />
                </div>
              </Tooltip>
            );
          })}
        </div>
      );
    };

    if (!selectedTab) {
      return <section className={styles.attrRoot}>{renderTab()}</section>;
    }

    return (
      <Resizable
        defaultSize={{ width: 340, height: '100%' }}
        minWidth={340}
        maxWidth="50%"
        enable={{
          bottom: false,
          bottomLeft: false,
          bottomRight: false,
          right: false,
          top: false,
          topLeft: false,
          topRight: false,
          left: true
        }}
      >
        <section className={styles.attrRoot}>
          {selectedTab && (
            <div className={styles.content}>
              {screenStore!.currLayer &&
                compTabKeys.indexOf(selectedTab.key) >= 0 && (
                  <div
                    className={styles.title}
                    style={{ display: 'flex', justifyContent: 'space-between' }}
                  >
                    {editLayerNameFlag
                      ? (
                      <Input
                        defaultValue={screenStore!.currLayer.name}
                        autoFocus
                        onBlur={onUpdateLayerName}
                        style={{ width: '70%' }}
                      />
                        )
                      : (
                      <div
                        // onDoubleClick={() => {
                        //   setEditLayerNameFlag(true);
                        // }}
                        style={{ width: '70%', overflow: 'hidden' }}
                      >
                        {screenStore!.currLayer.name}
                      </div>
                        )}
                  </div>
                )}
              {selectedTab.render(screenStore!.currLayer?.id)}
            </div>
          )}
          {renderTab()}
        </section>
      </Resizable>
    );
  })
);
