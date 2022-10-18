
const { Router } = require("express");
const router = Router();
const { Note, Folder } = require('./../../models')
const axios = require('axios')
const multer = require("multer")
const upload = multer();
const FormData = require("form-data"); 

// 내 노트 등록
//http://localhost:8080/record/ 
router.post('/', async (req, res, next) => {
    console.log(req.body);
    let { title, user_id, contents, file_url, memo, favorites  } = req.body
    try {
        // const authData = await User.findOne({email})
        await Note.create({
            user_id,
            title,
            contents,
            file_url,
            memo,
            favorites,

            // author: authData
        })
        res.json({
            status: true,
            message: '노트가 등록 되었습니다.'
        })
    } catch (e) {
        next(e)
    }
})

// 내 노트 조회
router.get('/', async (req, res, next) => {
    console.log('쿼리입니다', req.query);
    
    let { user_id } = req.params

    let page = Number(req.query.page) || 1 

    if (page < 1) {
        next('존재하지 않는 페이지 입니다.')
        return
    }

    let perPage = Number(req.query.perPage) || 10 
    if (perPage > 10) {
        next('한 페이지에 최대 10개의 노트를 볼 수 있습니다.')
        return
    }

    let total = await Note.countDocuments({})
    
    let note = await Note.find({ user_id: user_id })
                            .sort({ createdAt: -1 })
                            .skip(perPage * (page - 1)) 
                            .limit(perPage)
                            // .populate('folder') 

    let totalPage = Math.ceil(total / perPage)

    res.json({ note, totalPage })

})

// 내 노트 수정
//http://localhost:8080/record/user_id/update 
router.post("/:user_id/update", async (req, res, next) => {
    console.log(req);
    
    let { user_id } = req.params     // 이부분 수정해야 함 => user_id 는 노트 삭제할 때 사용하면 안됨
    let { title ,contents,  file_url , memo, favorites} = req.body;

    try {
        await Note.updateOne({ user_id }, {
            title,
            contents,
            file_url,
            memo,
            favorites
        }) ;

        res.json({
            status : true,
            message: "일기장을 수정했습니다."
        }) 
    } catch(e) {
        next(e);
    }
});

//내 노트 삭제
//http://localhost:8080/record/user_id/delete
router.post("/:shortId/delete", async (req, res, next) => {
    let { user_id } = req.params;
    try {

        //shortId에 해당하는 일기장을 삭제함.    => user_id 에 해당하는 것을 삭제 하면 안됨
        await Daily.deleteOne({ shortId });

        res.json({
            status: true,
            message: "일기장을 삭제하였습니다."
        });

    } catch (e) {
        next(e);
    }
})

// vito 토큰 발급
router.get("/vito/token", async (req, res, next) => {
    let CLIENT_ID = '3br-QGCM26NbrTCjlbQ1';
    let CLIENT_SECRET = 'kt0-bSwLg-R1Rf5G5mY4YzZyqgSHiJyhzK4u4QAQ';

    await axios.post(`https://openapi.vito.ai/v1/authenticate`,
        {client_id: CLIENT_ID, client_secret: CLIENT_SECRET},
        {
            headers: {
            'content-type': 'application/x-www-form-urlencoded'
            }
        }
    )
    .then(data => { 
        let tokenData = data.data
        res.json({tokenData}) 
    })
    .catch(e => next(e))
})

// vito id 발급 후 전사결과 출력
router.post("/vito/getResult", upload.single('file'), async (req, res, next) => {
    let formData = new FormData()

    let TRANSCRIBE_URL = 'https://openapi.vito.ai/v1/transcribe'
    let CONFIG = '{"diarization":{"use_verification":false},"use_multi_channel":false,"use_itn":false,"use_disfluency_filter":false,"use_profanity_filter":false,"paragraph_splitter": {"min": 10,"max": 50}}'
    
    formData.append('config', CONFIG)
    formData.append("file", req.file.buffer, {
        filename: req.file.originalname,
    })
        
    await axios.post(TRANSCRIBE_URL, formData,
        {
            headers: {
            'Authorization': `Bearer ${req.body.token}`,
            'Content-Type': 'multipart/form-data'
            }
        }
    )
    .then(response => {
        getVITORestlt(response.data.id, req.body.token)
        .then(data => {
            // 전사결과가 변환중일경우 stats === transcribing
            // 전사결과 변환완료 상태로 변할 때 까지 setInterval 사용하여 5초에 한번씩 getVITORestlt() 함수 실행
            let isStop = data.data.status === "transcribing" ? false : true 

            let interval = setInterval(function() {
                if (!isStop) {
                    getVITORestlt(response.data.id, req.body.token).then(
                        data2 => {
                            isStop = data2.data.status === "transcribing" ? false : true
                            let resData = data2.data
                            res.json({ resData })
                        })
                } else {
                    isStop = true
                    clearInterval(interval)
                }
            }, 5000)
        })
    })
    .catch(e => console.log(e))
})

// vito 전사 결과 출력 function
const getVITORestlt = async (id, token) => {
    // console.log("id:", id)
    let TRANSCRIBE_URL = 'https://openapi.vito.ai/v1/transcribe'
    return await axios.get(`${TRANSCRIBE_URL}/${id}` ,
    {
        headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
        }
    })
}

module.exports = router

