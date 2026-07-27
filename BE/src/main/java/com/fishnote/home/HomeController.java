package com.fishnote.home;

import com.fishnote.cache.PublicHttpCache;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/home")
public class HomeController {

    private final HomeService homeService;
    private final PublicHttpCache httpCache;

    public HomeController(HomeService homeService, PublicHttpCache httpCache) {
        this.homeService = homeService;
        this.httpCache = httpCache;
    }

    @GetMapping
    public ResponseEntity<HomeResponse> home(
            @RequestParam short month,
            @RequestParam(defaultValue = "popular") String sort) {
        return httpCache.list(homeService.getHome(month, sort));
    }
}
