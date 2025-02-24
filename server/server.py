from flask import Flask, request, jsonify, redirect, url_for, render_template
from flask_cors import CORS
from unified_interface import UnifiedInterface
import traceback
import os
import uuid
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
# 修改CORS配置，允许小程序域名
CORS(app, resources={r"/*": {"origins": "*"}})

# 初始化 UnifiedInterface
try:
    unified = UnifiedInterface()
    logger.info("UnifiedInterface 初始化成功")
except Exception as e:
    logger.error(f"初始化失败: {str(e)}")
    traceback.print_exc()

# 新增：存储会话历史
session_histories = {}

@app.route('/')
def home():
    return "服务器运行正常"

@app.route('/chat', methods=['GET', 'POST'])
def chat():
    if request.method == 'GET':
        return render_template('imagechat.html')
        
    try:
        logger.info("收到POST请求")
        logger.info(f"请求头: {request.headers}")
        
        # 处理图片上传
        if 'image' in request.files:
            file = request.files['image']
            logger.info(f"收到图片文件: {file.filename}")
            
            if not file.filename:
                logger.error("没有选择文件")
                return jsonify({"error": "没有选择文件"}), 400
            
            # 确保临时目录存在
            temp_dir = "temp_images"
            if not os.path.exists(temp_dir):
                os.makedirs(temp_dir)
            
            # 使用uuid生成唯一的文件名
            temp_path = os.path.join(temp_dir, f"{uuid.uuid4()}.jpg")
            logger.info(f"保存图片到临时文件: {temp_path}")
            
            try:
                file.save(temp_path)
                logger.info("图片保存成功")
                
                # 使用UnifiedInterface分析图片
                logger.info("开始分析图片")
                result = unified.analyze('image', temp_path)
                logger.info(f"图片分析结果: {result}")
                
                # 生成新的会话ID
                session_id = f"session_{uuid.uuid4()}"
                unified.session_id = session_id
                logger.info(f"生成新会话ID: {session_id}")
                
                # 删除临时文件
                try:
                    os.remove(temp_path)
                    logger.info("临时文件删除成功")
                except Exception as e:
                    logger.error(f"删除临时文件失败: {str(e)}")
                
                # 修改这里：直接返回分析结果，不需要包装在初始消息中
                response_data = {
                    "success": True,
                    "message": result,  # 直接返回分析结果
                    "sessionId": session_id
                }
                logger.info(f"返回响应: {response_data}")
                return jsonify(response_data)
                
            except Exception as e:
                logger.error(f"处理图片过程中出错: {str(e)}")
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                        logger.info("错误后清理临时文件成功")
                    except:
                        pass
                return jsonify({"error": f"处理图片失败: {str(e)}"}), 500
            
        # 处理文本消息
        else:
            data = request.json
            logger.info(f"收到文本请求数据: {data}")
            
            question = data.get('question')
            session_id = data.get('sessionId')
            
            if not question:
                logger.error("问题不能为空")
                return jsonify({"error": "问题不能为空"}), 400
                
            logger.info(f"处理问题: {question}, 会话ID: {session_id}")
            
            # 设置会话ID
            unified.session_id = session_id
            
            # 获取回答
            response = ""
            try:
                for chunk in unified.analyze('text', question, stream=True):
                    response += chunk
                logger.info(f"生成的回答: {response}")
                return jsonify({
                    "success": True,
                    "message": response,  # 包装在message字段中
                    "sessionId": session_id
                })
            except Exception as e:
                logger.error(f"生成回答时出错: {str(e)}")
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
            
    except Exception as e:
        logger.error(f"处理请求时出错: {str(e)}")
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    logger.info("启动服务器...")
    app.run(host='0.0.0.0', port=8000, debug=True)