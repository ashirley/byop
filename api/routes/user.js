import express from "express";

export const userUnauthenticatedRouterFn = () => {
  var router = express.Router();

  router.get("/login", function (req, res, next) {
    res.render("user/login")
    return;
  });

  router.post("/login", async function (req, res, next) {
    if (await req.users.validatePassword(req.body.user, req.body.pass)) {
      // regenerate the session, which is good practice to help
      // guard against forms of session fixation
      req.session.regenerate(function (err) {
        if (err) next(err);
  
        // store user information in session, typically a user id
        req.session.user = req.body.user;
  
        // save the session before redirection to ensure page
        // load does not happen before session is saved
        req.session.save(function (err) {
          if (err) return next(err);
          res.redirect('/');
        });
      });
    } else {
      // wrong username/password
      res.redirect('/user/login');
    }
  });

  router.post("/register", async function (req, res, next) {
    if (await req.users.register(req.body.user, req.body.pass)) {
      res.redirect('/user/login');
    } else {
      res.redirect('/user/login');
    }
  });

  return router;
};

export const userAuthenticatedRouterFn = () => {
  var router = express.Router();

  /* GET home page. */
  router.get("/", function (req, res, next) {
    res.render("user/login", {user: req.session.user})
    return;
  });

  router.get('/logout', function (req, res, next) {
    // logout logic

    // clear the user from the session object and save.
    // this will ensure that re-using the old session id
    // does not have a logged in user
    req.session.user = null;
    req.session.save(function (err) {
      if (err) next(err);

      // regenerate the session, which is good practice to help
      // guard against forms of session fixation
      req.session.regenerate(function (err) {
        if (err) next(err);
        res.redirect('/');
      });
    });
  });


  return router;
};
