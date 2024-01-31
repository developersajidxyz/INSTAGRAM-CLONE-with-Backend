var express = require('express');
var router = express.Router();
const userModel = require("./users");
const postModel = require("./post");
const upload = require("./multer");
const passport = require("passport");
const localStrategy = require("passport-local");

passport.use(new localStrategy(userModel.authenticate()));

router.get('/', function (req, res) {
  res.render('index', { footer: false });
});

router.get('/login', function (req, res) {
  res.render('login', { footer: false });
});

router.get('/feed', isLoggedIn, async function (req, res) {
  try {
    const user = await userModel.findOne({ username: req.session.passport.user })
    const posts = await postModel.find().populate("user");
    res.render('feed', { posts, user, footer: true }); 
  } catch (error) {
    console.error(error);
    res.render('error', { message: 'An error occurred', error: error });
  }
});


router.get('/profile', isLoggedIn, async function (req, res) {
  try {
    const user = await userModel.findOne({ username: req.session.passport.user }).populate("posts");

    if (!user) {
      return res.status(404).render('error', { message: 'User not found', error: { status: 404 } });
    }

    res.render('profile', { footer: true, user });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { message: 'Internal Server Error', error: { status: 500, stack: error.stack } });
  }
});


router.get('/search', isLoggedIn, function (req, res) {
  res.render('search', { footer: true });
});

// router.get('/like/post/:id', isLoggedIn, async function (req, res) {
//   console.log("/like/post/:id")
//   try {
//     const user = await userModel.findOne({username: req.session.passport.user});
//     const post = await postModel.findOne({_id: req.params.id});

//     if (!user || !post) {
//       return res.status(404).send('User or post not found');
//     }

//     if (!post.likes.includes(user._id)) {
//       post.likes.push(user._id);
//     } else {
//       post.likes = post.likes.filter(like => like.toString() !== user._id.toString());
//     }

//     await post.save();
//     res.redirect('/feed');
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Server error');
//   }
// });


router.get("/like/post/:id", isLoggedIn, async function (req, res) {
  const user = await userModel.findOne({ username: req.session.passport.user});
  const post = await postModel.findOne({_id: req.params.id});
  // if already liked remove like
  // if not liked, like it
  if(post.likes.indexOf(user._id) === -1){
  post.likes.push(user._id);
  }
  else{
  post.likes.splice(post.likes.indexOf(user._id), 1);
  }
  await post.save();
  res.redirect("/feed");
  });


router.get('/username/:username', isLoggedIn, async function (req, res) {
  const usernameParam = req.params.username;
  console.log('Username parameter:', usernameParam);

  const regex = new RegExp(`${usernameParam}`, "i");
  const users = await userModel.find({ username: regex });
  res.json(users);
});



router.get('/edit', isLoggedIn, async function (req, res) {
  const user = await userModel.findOne({username : req.session.passport.user});
  res.render('edit', { footer: true, user });
});

router.get('/upload', isLoggedIn, function (req, res) {
  res.render('upload', { footer: true });
});

router.post("/register", function (req, res, next) {
  const userData = new userModel({
    username: req.body.username,
    name: req.body.name,
    email: req.body.email,
    profileImage: req.body.profileImage
  });

  userModel.register(userData, req.body.password)
    .then(function () {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/profile");
      });
    });
});

router.post('/login', passport.authenticate('local', {
  successRedirect: '/profile',
  failureRedirect: '/login',
  failureFlash: true
}));

router.get('/logout', function (req, res, next) {
  req.logout(function (err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

router.post('/update', upload.single('image'), async function (req, res) {
  try {
    const user = await userModel.findOneAndUpdate(
      { username: req.session.passport.user },
      { username: req.body.username, name: req.body.name, bio: req.body.bio },
      { new: true }
    );

    if (!user) {
      return res.status(404).send('User not found');
    }

    if(req.file){
      user.profileImage = req.file.filename;
    }
    await user.save();
    res.redirect("/profile");
  } catch (err) {
    console.error(err);
    res.render('error', { message: 'An error occurred', error: { status: 404, stack: '...' } });
}
});

router.post("/upload",  isLoggedIn, upload.single("image"), async function(req, res){
  const user = await userModel.findOne({username : req.session.passport.user});
  const post = await postModel.create({
    picture: req.file.filename,
    user: user._id,
    caption: req.body.caption
  })

  user.posts.push(post._id);
  await user.save();
  res.redirect("/feed");
})

function isLoggedIn(req, res, next) { 
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

module.exports = router;
