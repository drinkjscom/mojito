## 组件属性
可以对组件的静态数据和数据源(动态数据)进行配置，平台会根据组件的[declare.json](declare.md)自动生成对应的选项和控件。

![组件属性](/assets/props.jpg)

数据源目前支持GET/POST请求获取，您可以在后端编写相应的接口，然后在平台上配置，返回结果会透传给组件。如果您想对数据进行更加精细的控制，可以通过 [交互事件](events.md)里的【数据源加载】事件进行加工处理。

![组件属性](/assets/datasource.jpg)

- 请求方式：GET/POST
- 请求接口：后端数据接口
- 请求参数：JSON格式
- 轮询：每隔多少毫秒请求一次接口，空或0表示不轮询