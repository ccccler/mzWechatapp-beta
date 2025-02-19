from face_analyzer import FaceAnalyzer
from his_simi_str import HistoryAwareRAG_simi

class UnifiedInterface:
    def __init__(self):
        self.face_analyzer = FaceAnalyzer()
        self.rag_analyzer = HistoryAwareRAG_simi()
        self.session_id = "default_session"  # 可以在需要时修改session_id

    def analyze(self, input_type, content, stream=True):
        """
        统一的分析接口
        :param input_type: 输入类型，'text' 或 'image'
        :param content: 如果是text则为提示词文本，如果是image则为图片路径
        :param stream: 是否使用流式输出（仅对text类型有效）
        :return: 分析结果
        """
        if input_type == 'image':
            # 使用FaceAnalyzer处理图片
            try:
                return self.face_analyzer.analyze(image_path=content)
            except Exception as e:
                return f"图片分析失败: {str(e)}"
                
        elif input_type == 'text':
            # 使用HistoryAwareRAG_simi处理文本
            try:
                if stream:
                    # 返回生成器，支持流式输出
                    return self.rag_analyzer.query(content, session_id=self.session_id)
                else:
                    # 如果不需要流式输出，使用get_response方法
                    return self.rag_analyzer.get_response(content)
            except Exception as e:
                return f"文本分析失败: {str(e)}"
        else:
            return "不支持的输入类型，请使用 'text' 或 'image'"

if __name__ == "__main__":
    # 使用示例
    analyzer = UnifiedInterface()
    
    # 分析图片示例
    # result = analyzer.analyze('image', 'wxprograme/server/照片1.jpg')
    # print("图片分析结果:", result)
    
    # 分析文本示例（流式输出）
    print("文本分析结果:")
    for chunk in analyzer.analyze('text', '请问如何护理油性肌肤？'):
        print(chunk, end="", flush=True)
    print("\n")
