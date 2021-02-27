/* eslint-disable react/display-name */
import React, { useEffect, useRef, useState } from 'react';
import { observer, inject } from 'mobx-react';
import anime from 'animejs';
import { CaretRightOutlined, StepForwardOutlined } from '@ant-design/icons';
import { InputNumber, Button, Form, Select, Row, Col } from 'antd';
import { ScreenStore } from 'types';
import Message from 'components/Message';

interface Props {
  screenStore?: ScreenStore;
}

const easings = [
  'linear',
  'easeInQuad',
  'easeInCubic',
  'easeInQuart',
  'easeInQuint',
  'easeInSine',
  'easeInExpo',
  'easeInCirc',
  'easeInBack',
  'easeInElastic',
  'easeInBounce',
  'easeOutQuad',
  'easeOutCubic',
  'easeOutQuart',
  'easeOutQuint',
  'easeOutSine',
  'easeOutExpo',
  'easeOutCirc',
  'easeOutBack',
  'easeOutElastic',
  'easeOutBounce',
  'easeInOutQuad',
  'easeInOutCubic',
  'easeInOutQuart',
  'easeInOutQuint',
  'easeInOutSine',
  'easeInOutExpo',
  'easeInOutCirc',
  'easeInOutBack',
  'easeInOutElastic',
  'easeInOutBounce'
];

const animeFields = [
  {
    label: 'X',
    name: 'translateX',
    render: () => <InputNumber style={{ width: '90%' }} />
  },
  {
    label: 'Y',
    name: 'translateY',
    render: () => <InputNumber style={{ width: '90%' }} />
  },
  {
    label: '宽度',
    name: 'width',
    render: () => <InputNumber style={{ width: '90%' }} />
  },
  {
    label: '高度',
    name: 'height',
    render: () => <InputNumber style={{ width: '90%' }} />
  },
  {
    label: '角度',
    name: 'rotate',
    render: () => <InputNumber style={{ width: '90%' }} />
  },
  {
    label: '缩放',
    name: 'scale',
    render: () => <InputNumber style={{ width: '90%' }} step={0.1} />
  },
  {
    label: '透明度',
    name: 'opacity',
    render: () => (
      <InputNumber style={{ width: '90%' }} min={0} max={1} step={0.1} />
    )
  },
  {
    label: '次数',
    name: 'loop',
    render: () => <InputNumber style={{ width: '90%' }} />
  },
  {
    label: '持续',
    name: 'duration',
    default: 500,
    render: () => <InputNumber style={{ width: '90%' }} />
  },
  {
    label: '延时',
    name: 'delay',
    render: () => <InputNumber style={{ width: '90%' }} />
  },
  {
    label: '效果',
    name: 'easing',
    default: 'easeInQuad',
    render: () => (
      <Select style={{ width: '90%' }}>
        {easings.map((v) => (
          <Select.Option key={v} value={v}>
            {v}
          </Select.Option>
        ))}
      </Select>
    )
  },
  {
    label: '方向',
    name: 'direction',
    default: 'normal',
    render: () => (
      <Select style={{ width: '90%' }}>
        {['normal', 'reverse', 'alternate'].map((v) => (
          <Select.Option key={v} value={v}>
            {v}
          </Select.Option>
        ))}
      </Select>
    )
  }
];

export default inject('screenStore')(
  observer((props: Props) => {
    const { screenStore } = props;
    const [form] = Form.useForm();
    const [playing, setPlaying] = useState(false);
    const [saveing, setSaveing] = useState(false);
    const currAnime = useRef<anime.AnimeInstance | undefined | null>();
    const currElement = useRef<any>(
      screenStore!.currLayer
        ? document.getElementById(screenStore!.currLayer!.id)
        : undefined
    );

    useEffect(() => {
      return () => {
        if (currAnime.current && currElement.current) {
          currAnime.current.pause();
          currAnime.current.seek(0);
          currAnime.current = null;
          anime.remove(currElement.current);
        }
      };
    }, []);

    const onReset = () => {
      const initialValues: any = {};
      const layerAnime: any = screenStore!.currLayer?.anime;
      animeFields.forEach((v) => {
        initialValues[v.name] = layerAnime
          ? layerAnime.params[v.name]
          : v.default;
      });

      form.setFieldsValue(initialValues);
    };

    const onSave = async () => {
      if (!screenStore!.currLayer) return;

      const values = await form.validateFields();
      const disable = !!values.disable;
      delete values.disable;
      setSaveing(true);
      screenStore!
        .updateLayer(screenStore!.currLayer.id, {
          anime: {
            disable,
            params: values
          }
        })
        .then((rel) => {
          rel && Message.success('保存成功');
        })
        .finally(() => {
          setSaveing(false);
        });
    };

    const onTest = () => {
      if (!screenStore!.currLayer) return;

      if (playing && currAnime.current) {
        setPlaying(false);
        currAnime.current.pause();
        currAnime.current.seek(0);
        return;
      }

      form.validateFields().then((values) => {
        if (
          values.translateX === undefined &&
          values.translateY === undefined &&
          values.scale === undefined &&
          values.rotate === undefined &&
          values.opacity === undefined &&
          values.width === undefined &&
          values.height === undefined
        ) {
          return;
        }

        const params: any = {};
        Object.keys(values).forEach((key) => {
          if (values[key] !== undefined) {
            params[key] = values[key];
          }
        });

        if (params.loop !== undefined && params.loop === 0) {
          params.loop = true;
        }

        currAnime.current = anime({
          ...params,
          targets: document.getElementById(screenStore!.currLayer!.id),
          begin: () => {
            setPlaying(true);
          },
          complete: () => {
            setPlaying(false);
          }
        });
      });
    };

    const initialValues: any = {};
    const layerAnime: any = screenStore!.currLayer?.anime;
    animeFields.forEach((v) => {
      initialValues[v.name] = layerAnime
        ? layerAnime.params[v.name]
        : v.default;
    });

    return (
      <div
        style={{
          display: 'flex',
          height: '100%',
          paddingLeft: '12px',
          marginTop: 12,
          flexDirection: 'column'
        }}
      >
        <Form
          form={form}
          key={screenStore!.currLayer ? screenStore!.currLayer.id : '1'}
          labelCol={{ span: 6 }}
          wrapperCol={{ span: 18 }}
          initialValues={initialValues}
        >
          <Row>
            {animeFields.map((v) => {
              return (
                <Col key={v.name} span={12}>
                  <Form.Item
                    label={v.label}
                    name={v.name}
                    preserve={false}
                    rules={[{ required: false }]}
                  >
                    {v.render()}
                  </Form.Item>
                </Col>
              );
            })}
            {/* <Col span={12}>
              <Form.Item
                name="disable"
                label="是否停用"
                valuePropName="checked"
                labelCol={{ span: 12 }}
                wrapperCol={{ span: 12 }}
              >
                <Switch />
              </Form.Item>
            </Col> */}
          </Row>
        </Form>
        <div style={{ textAlign: 'center' }}>
          <Button style={{ margin: '3px' }} onClick={onReset}>
            重置
          </Button>
          <Button
            type="primary"
            style={{ margin: '3px' }}
            onClick={onSave}
            loading={saveing}
          >
            保存
          </Button>
          <Button
            type="primary"
            style={{ margin: '3px' }}
            onClick={onTest}
            icon={playing ? <StepForwardOutlined /> : <CaretRightOutlined />}
          >
            {playing ? '停止' : '播放'}
          </Button>
        </div>
      </div>
    );
  })
);